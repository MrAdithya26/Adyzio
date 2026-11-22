<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'admin_init', function () {
	register_setting( 'adyzio_settings_group', 'adyzio_settings', array(
		'type'              => 'array',
		'sanitize_callback' => function ( $in ) {
			$in  = is_array( $in ) ? $in : array();
			$out = array(
				'store_links' => sanitize_textarea_field( $in['store_links'] ?? '' ),
				'banners'     => sanitize_textarea_field( $in['banners'] ?? '' ),
			);
			foreach ( adyzio_social_networks() as $k => $_ ) {
				$out[ $k ] = esc_url_raw( trim( (string) ( $in[ $k ] ?? '' ) ) );
			}
			return $out;
		},
	) );
} );

/* "Install the Adyzio category list" button: runs in batches so the browser can show progress. */
add_action( 'wp_ajax_adyzio_cats_step', function () {
	if ( ! current_user_can( 'manage_options' ) || ! check_ajax_referer( 'adyzio_cats', 'nonce', false ) ) {
		wp_send_json( array( 'error' => 'Not allowed. Reload the page and try again.' ) );
	}
	if ( function_exists( 'set_time_limit' ) ) {
		@set_time_limit( 120 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
	}
	$offset = isset( $_POST['offset'] ) ? absint( $_POST['offset'] ) : 0;
	if ( 0 === $offset ) {
		delete_option( 'adyzio_catmap' );
	}
	$r    = adyzio_install_categories( $offset, 60 );
	$done = $r['next'] >= $r['total'];
	if ( $done ) {
		$r['migrate'] = ! empty( $_POST['migrate'] ) ? adyzio_migrate_old_categories() : null;
		do_action( 'litespeed_purge_all' );
	}
	$r['done'] = $done;
	if ( $done ) {
		update_option( 'adyzio_cats_done', count( adyzio_category_list() ), false );
		delete_option( 'adyzio_cats_bg_offset' );
	}
	wp_send_json( $r );
} );

/* After an update, add the category list in the background (adds only; never moves or deletes anything). */
function adyzio_cats_installed() {
	return (int) get_option( 'adyzio_cats_done' ) >= count( adyzio_category_list() );
}
add_action( 'admin_init', function () {
	if ( ! adyzio_cats_installed() && ! wp_next_scheduled( 'adyzio_cats_bg' ) ) {
		wp_schedule_single_event( time(), 'adyzio_cats_bg' );
	}
} );
add_action( 'adyzio_cats_bg', function () {
	if ( adyzio_cats_installed() ) {
		return;
	}
	$off = (int) get_option( 'adyzio_cats_bg_offset', 0 );
	$r   = adyzio_install_categories( $off, 80 );
	if ( $r['next'] >= $r['total'] ) {
		update_option( 'adyzio_cats_done', $r['total'], false );
		delete_option( 'adyzio_cats_bg_offset' );
	} else {
		update_option( 'adyzio_cats_bg_offset', $r['next'], false );
		wp_schedule_single_event( time() + 5, 'adyzio_cats_bg' );
	}
} );
add_action( 'admin_notices', function () {
	if ( adyzio_cats_installed() || ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$off = (int) get_option( 'adyzio_cats_bg_offset', 0 );
	echo '<div class="notice notice-info"><p><strong>Adyzio Core ' . esc_html( ADYZIO_VERSION ) . ':</strong> adding the category list in the background (' . (int) $off . ' of ' . (int) count( adyzio_category_list() ) . '). '
		. 'It finishes by itself while you use the dashboard. To finish now, or to also tidy the old starter categories, go to <a href="' . esc_url( admin_url( 'options-general.php?page=adyzio' ) ) . '">Settings → Adyzio</a> and click <em>Install the Adyzio category list</em>.</p></div>';
} );

add_action( 'admin_menu', function () {
	add_options_page( 'Adyzio', 'Adyzio', 'manage_options', 'adyzio', 'adyzio_settings_page' );
} );

function adyzio_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$s     = adyzio_settings();
	$total = count( adyzio_category_list() );
	$tops  = array_filter( adyzio_category_list(), function ( $c ) { return '' === $c[2]; } );
	?>
	<div class="wrap">
		<h1>Adyzio settings</h1>
		<?php adyzio_version_box(); ?>
		<h2>Categories</h2>
		<p>Installs the Adyzio category list: <strong><?php echo (int) $total; ?></strong> categories in three levels (main → sub → child), built from Amazon, Flipkart, Myntra and AJIO. Main categories: <?php echo esc_html( implode( ', ', wp_list_pluck( $tops, 0 ) ) ); ?>.</p>
		<p>Categories you already have are reused, never duplicated. Safe to run again.</p>
		<p><label><input type="checkbox" id="adz-cat-migrate" checked> Move deals from the old starter categories (Mobiles &amp; Accessories, Student Essentials, Appliances, Two Wheelers &amp; Auto …) into the new list, remove those old categories once they're empty, and re-sort imported products that are still drafts</label></p>
		<p><button type="button" class="button button-primary" id="adz-cat-go">Install the Adyzio category list</button></p>
		<div id="adz-cat-prog" hidden style="max-width:640px">
			<p style="margin:8px 0"><b id="adz-cat-pct" style="font-size:22px;color:#2a2470">0%</b> <span id="adz-cat-msg"></span></p>
			<div style="height:10px;background:#ecebfb;border-radius:99px;overflow:hidden"><span id="adz-cat-fill" style="display:block;height:100%;width:0;background:#2a2470;transition:width .3s"></span></div>
		</div>
		<script>
		(function(){
			var b = document.getElementById('adz-cat-go'); if (!b) return;
			var ajax = <?php echo wp_json_encode( admin_url( 'admin-ajax.php' ) ); ?>, nonce = <?php echo wp_json_encode( wp_create_nonce( 'adyzio_cats' ) ); ?>;
			var added = 0, reused = 0;
			function $(i){ return document.getElementById(i); }
			function step(offset){
				var fd = new FormData(); fd.append('action','adyzio_cats_step'); fd.append('nonce',nonce); fd.append('offset',offset); if ($('adz-cat-migrate').checked) fd.append('migrate','1');
				fetch(ajax,{method:'POST',body:fd,credentials:'same-origin'}).then(function(r){ return r.json(); }).then(function(r){
					if (r.error) { $('adz-cat-msg').textContent = r.error; b.disabled = false; return; }
					added += r.added; reused += r.reused;
					var pct = Math.floor(r.next / r.total * 100);
					$('adz-cat-pct').textContent = pct + '%'; $('adz-cat-fill').style.width = pct + '%';
					$('adz-cat-msg').textContent = r.next + ' of ' + r.total + ' · ' + added + ' added, ' + reused + ' already there';
					if (!r.done) return step(r.next);
					$('adz-cat-fill').style.background = '#16794a'; $('adz-cat-pct').style.color = '#16794a';
					$('adz-cat-msg').textContent = 'Complete · ' + added + ' added, ' + reused + ' already there' + (r.migrate ? ' · ' + r.migrate.moved + ' deals moved, ' + r.migrate.removed + ' old categories removed, ' + r.migrate.resorted + ' imported drafts sorted into the new categories' : '');
					b.disabled = false;
				}).catch(function(){ setTimeout(function(){ step(offset); }, 2000); });
			}
			b.addEventListener('click', function(){ b.disabled = true; added = reused = 0; $('adz-cat-prog').hidden = false; step(0); });
		})();
		</script>
		<hr>
		<form method="post" action="options.php">
			<?php settings_fields( 'adyzio_settings_group' ); ?>
			<table class="form-table" role="presentation">
				<?php foreach ( adyzio_social_networks() as $k => $net ) : ?>
				<tr>
					<th scope="row"><label for="adz-<?php echo esc_attr( $k ); ?>"><?php echo esc_html( $net[0] ); ?> link</label></th>
					<td><input id="adz-<?php echo esc_attr( $k ); ?>" class="regular-text" type="url" name="adyzio_settings[<?php echo esc_attr( $k ); ?>]" value="<?php echo esc_attr( $s[ $k ] ); ?>" placeholder="https://"></td>
				</tr>
				<?php endforeach; ?>
				<tr><td colspan="2"><p class="description">Leave a social link empty to hide it. Filled links show as "Follow Adyzio" buttons on the homepage and at the bottom of every page.</p></td></tr>
				<tr>
					<th scope="row"><label for="adz-sl">Store links</label></th>
					<td>
						<textarea id="adz-sl" class="large-text code" rows="10" name="adyzio_settings[store_links]" placeholder="Flipkart = https://...&#10;Myntra = https://..."><?php echo esc_textarea( $s['store_links'] ); ?></textarea>
						<p class="description">One store per line: <code>Store name = your affiliate link</code> (ExtraPe link, or Amazon SiteStripe link). Stores with a link here show on the homepage: shopping stores under "Top stores", and travel, finance and hosting stores (e.g. <code>Hostinger = …</code>, <code>MakeMyTrip Domestic Hotels = …</code>, <code>SBI Credit Card = …</code>) in their own section.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="adz-bn">Homepage banners</label></th>
					<td>
						<textarea id="adz-bn" class="large-text code" rows="6" name="adyzio_settings[banners]" placeholder="main | Big festive sale on Flipkart | Up to 80% off on electronics | Shop now | https://your-extrape-link"><?php echo esc_textarea( $s['banners'] ); ?></textarea>
						<p class="description">Optional. One banner per line: <code>section | headline | short text | button text | link</code>. Section is <code>main</code>, <code>shopping</code>, <code>travel</code>, <code>finance</code>, <code>hosting</code> or <code>services</code>. Link can be your affiliate link, <code>telegram</code>, <code>whatsapp</code>, a category like <code>#c/student</code>, or a section like <code>#travel</code>. Leave empty to use the built-in banners. Only write offers you have seen on the store.</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}
