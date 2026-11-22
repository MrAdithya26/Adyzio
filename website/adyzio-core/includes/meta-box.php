<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/*
 * "Deal details" box in the post editor. Saves to these custom fields:
 * buy_link, store, deal_type, image_url, price, mrp, price_checked (timestamp), deal_ends (timestamp), good_for, check_list
 */

add_action( 'add_meta_boxes', function () {
	add_meta_box( 'adyzio_deal', 'Adyzio: deal details', 'adyzio_deal_box', 'post', 'normal', 'high' );
} );

function adyzio_deal_box( $post ) {
	wp_nonce_field( 'adyzio_deal_save', 'adyzio_deal_nonce' );
	$m = function ( $k ) use ( $post ) {
		return get_post_meta( $post->ID, $k, true );
	};
	$tz      = wp_timezone();
	$ends    = (int) $m( 'deal_ends' );
	$ends_v  = $ends ? wp_date( 'Y-m-d\TH:i', $ends, $tz ) : '';
	$checked = (int) $m( 'price_checked' );
	$stores  = adyzio_stores();
	$type    = $m( 'deal_type' );
	?>
	<style>
		.adz-mb{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px 18px}
		.adz-mb label{display:block;font-weight:600;margin-bottom:4px}
		.adz-mb input[type=text],.adz-mb input[type=url],.adz-mb input[type=number],.adz-mb input[type=datetime-local],.adz-mb select,.adz-mb textarea{width:100%}
		.adz-mb .full{grid-column:1/-1}
		.adz-mb small{color:#646970;display:block;margin-top:3px}
	</style>
	<div class="adz-mb">
		<div class="full">
			<label for="adz-buy">Affiliate link (Buy Now button)</label>
			<input type="url" id="adz-buy" name="adz[buy_link]" value="<?php echo esc_attr( $m( 'buy_link' ) ); ?>" placeholder="https://amzn.to/... or your ExtraPe link">
			<small>Leave empty for buying guides with several products; the card will open the post instead.</small>
			<?php $plink = get_post_meta( $post->ID, 'product_link', true ); ?>
			<?php if ( $plink ) : ?>
				<small style="display:block;margin-top:6px;padding:6px 8px;background:#fff8e5;border-left:3px solid #e8890c">
					Store link from import: <a href="<?php echo esc_url( $plink ); ?>" target="_blank" rel="noopener"><?php echo esc_html( wp_trim_words( $plink, 12, '…' ) ); ?></a><br>
					Convert it to your affiliate link (ExtraPe for Flipkart and others, SiteStripe for Amazon) and paste it above. The store link itself is never used as the Buy link.
				</small>
			<?php endif; ?>
		</div>
		<div>
			<label for="adz-store">Store</label>
			<input type="text" id="adz-store" name="adz[store]" list="adz-store-list" value="<?php echo esc_attr( $m( 'store' ) ); ?>" placeholder="Amazon, Flipkart, Myntra…">
			<datalist id="adz-store-list">
				<?php foreach ( $stores as $k => $s ) : ?>
					<option value="<?php echo esc_attr( $s['n'] ); ?>"></option>
				<?php endforeach; ?>
			</datalist>
		</div>
		<div>
			<label for="adz-type">Deal type</label>
			<select id="adz-type" name="adz[deal_type]">
				<option value="" <?php selected( $type, '' ); ?>>Normal</option>
				<option value="loot" <?php selected( $type, 'loot' ); ?>>Loot Deal</option>
				<option value="today" <?php selected( $type, 'today' ); ?>>Get Today</option>
				<option value="drop" <?php selected( $type, 'drop' ); ?>>Price Drop</option>
			</select>
		</div>
		<div>
			<label for="adz-price">Price you saw (₹)</label>
			<input type="number" id="adz-price" name="adz[price]" min="0" step="1" value="<?php echo esc_attr( $m( 'price' ) ); ?>">
		</div>
		<div>
			<label for="adz-mrp">MRP (₹)</label>
			<input type="number" id="adz-mrp" name="adz[mrp]" min="0" step="1" value="<?php echo esc_attr( $m( 'mrp' ) ); ?>">
		</div>
		<div class="full">
			<label><input type="checkbox" name="adz[checked_now]" value="1"> I checked this price on the store page just now</label>
			<small>
				<?php
				echo $checked
					? 'Last checked: ' . esc_html( wp_date( 'j M Y, g:i a', $checked, $tz ) ) . '. '
					: 'Price not checked yet. ';
				?>
				The site shows the price for 24 hours after you tick this, then shows "Check latest price" until you check again.
			</small>
		</div>
		<div>
			<label for="adz-ends">Deal ends (optional)</label>
			<input type="datetime-local" id="adz-ends" name="adz[deal_ends]" value="<?php echo esc_attr( $ends_v ); ?>">
			<small>Only if the store shows an end time. Shows a countdown.</small>
		</div>
		<div>
			<label for="adz-img">Product image link</label>
			<input type="url" id="adz-img" name="adz[image_url]" value="<?php echo esc_attr( $m( 'image_url' ) ); ?>" placeholder="Image link from SiteStripe or ExtraPe">
			<small>Or set a Featured image with your own photo.</small>
		</div>
		<div class="full">
			<label for="adz-good">Good for</label>
			<input type="text" id="adz-good" name="adz[good_for]" value="<?php echo esc_attr( $m( 'good_for' ) ); ?>" placeholder="e.g. Engineering students on a budget">
		</div>
		<div class="full">
			<label for="adz-check">Check before you buy (one per line)</label>
			<textarea id="adz-check" name="adz[check_list]" rows="3" placeholder="Warranty period&#10;Return window"><?php echo esc_textarea( $m( 'check_list' ) ); ?></textarea>
		</div>
	</div>
	<?php
}

add_action( 'save_post_post', function ( $post_id ) {
	if ( ! isset( $_POST['adyzio_deal_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['adyzio_deal_nonce'] ) ), 'adyzio_deal_save' ) ) {
		return;
	}
	if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	$in = isset( $_POST['adz'] ) && is_array( $_POST['adz'] ) ? wp_unslash( $_POST['adz'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput

	$set = function ( $key, $value ) use ( $post_id ) {
		if ( '' === $value || null === $value ) {
			delete_post_meta( $post_id, $key );
		} else {
			update_post_meta( $post_id, $key, $value );
		}
	};

	$set( 'buy_link', esc_url_raw( trim( $in['buy_link'] ?? '' ) ) );
	$set( 'store', sanitize_text_field( $in['store'] ?? '' ) );
	$type = sanitize_key( $in['deal_type'] ?? '' );
	$set( 'deal_type', in_array( $type, array( 'loot', 'today', 'drop' ), true ) ? $type : '' );
	$set( 'image_url', esc_url_raw( trim( $in['image_url'] ?? '' ) ) );
	$price = trim( (string) ( $in['price'] ?? '' ) );
	$mrp   = trim( (string) ( $in['mrp'] ?? '' ) );
	$set( 'price', '' === $price ? '' : (string) absint( $price ) );
	$set( 'mrp', '' === $mrp ? '' : (string) absint( $mrp ) );
	$set( 'good_for', sanitize_text_field( $in['good_for'] ?? '' ) );
	$set( 'check_list', sanitize_textarea_field( $in['check_list'] ?? '' ) );

	if ( ! empty( $in['checked_now'] ) ) {
		update_post_meta( $post_id, 'price_checked', time() );
	}

	$ends = trim( (string) ( $in['deal_ends'] ?? '' ) );
	if ( '' === $ends ) {
		delete_post_meta( $post_id, 'deal_ends' );
	} else {
		$dt = date_create_immutable( $ends, wp_timezone() );
		if ( $dt ) {
			update_post_meta( $post_id, 'deal_ends', $dt->getTimestamp() );
		}
	}
} );
