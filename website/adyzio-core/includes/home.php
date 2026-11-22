<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** True when the current page uses [adyzio_home]. */
function adyzio_is_home_page() {
	if ( ! is_singular() ) {
		return false;
	}
	$post = get_post();
	return $post && has_shortcode( $post->post_content, 'adyzio_home' );
}

/** Load the homepage CSS/JS only on pages that use [adyzio_home]. */
add_action( 'wp_enqueue_scripts', function () {
	if ( ! adyzio_is_home_page() ) {
		return;
	}
	wp_enqueue_style( 'adyzio-fonts', 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;600;700&family=Noto+Sans+Telugu:wght@400;600&display=swap', array(), null );
	wp_enqueue_style( 'adyzio-home', ADYZIO_URL . 'assets/adyzio.css', array(), ADYZIO_VERSION );
	wp_enqueue_script( 'adyzio-home', ADYZIO_URL . 'assets/adyzio.js', array(), ADYZIO_VERSION, true );
	wp_add_inline_script( 'adyzio-home', 'window.ADYZIO_DATA=' . wp_json_encode( adyzio_home_data() ) . ';', 'before' );
} );

/* The homepage has its own header, so the theme header is hidden there (CSS uses this class). */
add_filter( 'body_class', function ( $classes ) {
	if ( adyzio_is_home_page() ) {
		$classes[] = 'adz-home';
	}
	return $classes;
} );

add_shortcode( 'adyzio_home', function () {
	$s     = adyzio_settings();
	$verts = adyzio_verticals();
	ob_start();
	?>
<div class="adz-app" id="adz-app">
	<header class="adz-head">
		<div class="adz-wrap adz-vrow">
			<nav class="adz-verts" id="adz-verts" aria-label="Adyzio sections">
				<?php foreach ( $verts as $k => $v ) : ?>
					<a class="adz-vt<?php echo 'main' === $k ? ' adz-vt-main' : ''; ?>" href="#<?php echo 'main' === $k ? 'adyzio' : esc_attr( $k ); ?>" data-v="<?php echo esc_attr( $k ); ?>">
						<?php if ( 'main' === $k ) : ?>
							<b class="adz-logo">adyz<i>io</i></b>
						<?php else : ?>
							<span data-vt="<?php echo esc_attr( $k ); ?>"><?php echo esc_html( $v[0] ); ?></span>
						<?php endif; ?>
					</a>
				<?php endforeach; ?>
			</nav>
		</div>
		<div class="adz-wrap adz-hrow">
			<label class="adz-search" for="adz-q">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
				<input id="adz-q" type="search" placeholder="Search for products, brands and more" autocomplete="off" aria-label="Search deals">
			</label>
			<div class="adz-hbtns">
				<button type="button" class="adz-hb" id="adz-lang" aria-pressed="false">తెలుగు</button>
				<a class="adz-hb" id="adz-wishBtn" href="#saved">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.5 12 21 12 21z"/></svg>
					<span data-i="saved">Saved</span><span class="adz-wcount" id="adz-wc">0</span>
				</a>
			</div>
		</div>
	</header>

	<nav class="adz-wrap adz-strip" id="adz-strip" aria-label="Categories"></nav>

	<div id="adz-homeview">
		<section class="adz-wrap adz-hero" id="adz-hero" aria-roledescription="carousel" aria-label="Highlights"></section>
		<div id="adz-blocks"></div>
	</div>

	<section class="adz-wrap adz-list" id="adz-list" hidden>
		<div class="adz-panel adz-listhead">
			<nav class="adz-crumbs" id="adz-crumbs" aria-label="Breadcrumb"></nav>
			<div class="adz-bartitle"><h1 id="adz-gtitle">All deals</h1><span class="adz-count" id="adz-count"></span></div>
			<div class="adz-subs" id="adz-subs"></div>
		</div>
		<div class="adz-main">
			<aside class="adz-rail adz-panel" aria-label="Filters">
				<div>
					<h3 data-i="fType">Deal type</h3>
					<label class="adz-opt"><input type="checkbox" value="loot" class="adz-ft"> <span data-i="loot">Loot deal</span></label>
					<label class="adz-opt"><input type="checkbox" value="today" class="adz-ft"> <span data-i="today">Today's deal</span></label>
					<label class="adz-opt"><input type="checkbox" value="drop" class="adz-ft"> <span data-i="drop">Price drop</span></label>
				</div>
				<div>
					<h3 data-i="fPrice">Price (₹)</h3>
					<div class="adz-rangerow">
						<input id="adz-pmin" type="number" inputmode="numeric" placeholder="Min" min="0" aria-label="Minimum price">
						<input id="adz-pmax" type="number" inputmode="numeric" placeholder="Max" min="0" aria-label="Maximum price">
					</div>
					<div class="adz-quick" id="adz-quick"></div>
				</div>
				<div>
					<h3 data-i="fOff">Minimum discount</h3>
					<select id="adz-minoff" aria-label="Minimum discount">
						<option value="0">Any</option><option value="30">30% or more</option><option value="50">50% or more</option><option value="70">70% or more</option>
					</select>
				</div>
				<div>
					<h3 data-i="fSort">Sort</h3>
					<select id="adz-sort" aria-label="Sort deals">
						<option value="new">Newest</option>
						<option value="off">Biggest discount</option>
						<option value="low">Price: low to high</option>
						<option value="high">Price: high to low</option>
					</select>
				</div>
				<button type="button" class="adz-ghost" id="adz-reset" data-i="reset">Clear filters</button>
			</aside>
			<div class="adz-grid" id="adz-grid"></div>
		</div>
	</section>

	<section class="adz-join">
		<div class="adz-wrap">
			<div>
				<h3 data-i="jH">Get loot deals before they sell out</h3>
				<p data-i="jP">Free alerts on Telegram and WhatsApp. A few useful picks a day, no spam.</p>
			</div>
			<div class="adz-joinb">
				<a class="adz-jbtn adz-tg" href="<?php echo esc_url( $s['telegram'] ); ?>" target="_blank" rel="noopener" data-i="jT">Join Telegram</a>
				<a class="adz-jbtn adz-wa" href="<?php echo esc_url( $s['whatsapp'] ); ?>" target="_blank" rel="noopener" data-i="jW">Join WhatsApp</a>
			</div>
		</div>
		<?php
		$others = array_diff_key( adyzio_social_links(), array( 'telegram' => 1, 'whatsapp' => 1 ) );
		if ( $others ) :
			?>
			<div class="adz-wrap adz-follow"><span data-i="follow">Follow Adyzio</span><?php echo adyzio_social_html(); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside ?></div>
		<?php endif; ?>
	</section>

	<section class="adz-wrap adz-how">
		<div><span class="adz-n">1</span><h4 data-i="s1">Pick a deal</h4><p data-i="s1p">Browse by category or store, or search. Save the ones you like with the heart.</p></div>
		<div><span class="adz-n">2</span><h4 data-i="s2">Read who it suits</h4><p data-i="s2p">The "Good for" line tells you if it fits your need. Tap the title for what to check before buying.</p></div>
		<div><span class="adz-n">3</span><h4 data-i="s3">Buy on the store</h4><p data-i="s3p">The button opens Amazon, Flipkart or the store's own page. Confirm today's price there and check out.</p></div>
	</section>

	<section class="adz-wrap adz-faq">
		<h2 data-i="fq">Questions</h2>
		<details><summary data-i="q1">What is Adyzio?</summary><p data-i="a1">Adyzio is the deals site of ABD Innovations, Andhra Pradesh. We pick useful products from Indian stores, write a short note on each and link you to the store to buy.</p></details>
		<details><summary data-i="q2">Do you earn from these links?</summary><p data-i="a2">Yes. Adyzio is an Amazon Associate and also earns through ExtraPe for Flipkart, Myntra, Ajio and other stores. You pay the same price; the store pays us a small commission.</p></details>
		<details><summary data-i="q3">Are the prices live?</summary><p data-i="a3">No. A card shows a price only for 24 hours after we checked it, with the time we checked. After that it says "Check latest price". Always confirm on the store page before paying.</p></details>
		<details><summary data-i="q4">Do you show ratings or reviews?</summary><p data-i="a4">No. Ratings stay on the store's page where they are current. We only write who the product is for.</p></details>
	</section>

	<div class="adz-scrim" id="adz-scrim" hidden><div class="adz-sheet" role="dialog" aria-modal="true" aria-labelledby="adz-mT" id="adz-sheet"></div></div>
	<div class="adz-toast" id="adz-toast" role="status" hidden></div>
	<noscript><p class="adz-wrap">Turn on JavaScript to see deals, or open <a href="<?php echo esc_url( get_post_type_archive_link( 'post' ) ?: home_url( '/' ) ); ?>">all posts</a>.</p></noscript>
</div>
	<?php
	return ob_get_clean();
} );
