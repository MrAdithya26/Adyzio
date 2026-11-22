<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** What changed in each version (newest first). Shown in Settings → Adyzio. */
function adyzio_changelog() {
	return array(
		'1.6.0' => array( '3 Nov 2026', array(
			'Rank Math SEO for products: SEO title = product name as it is, focus keyword = short product name (+ "… price" and child category), meta description, short URL slug for new imports.',
			'One-line honest intro for imported products with no text, and an "Apply SEO to all products" button with progress (Tools → Adyzio Import).',
			'Categories now install by themselves in the background after an update, with a notice until done.',
			'Category pages and search now load every matching product from the site, not only the newest 200.',
			'This version history, and the version number in the zip file name.',
		) ),
		'1.5.0' => array( '3 Nov 2026', array(
			'Your full category list: 726 categories (20 main → sub → child) from Amazon, Flipkart, Myntra and AJIO.',
			'"Install the Adyzio category list" button with progress; old starter categories merged and imported drafts re-sorted.',
			'Scrolling category bar with arrows and a Flipkart-style mega-menu; 3-level breadcrumbs on category pages.',
			'Importer and sheet sync file products into child categories; new Child Category and Full Category Path columns.',
		) ),
		'1.4.0' => array( '3 Nov 2026', array(
			'No more duplicate posts: each product is recognised by its store link, so importing again updates it.',
			'Live % progress with a line graph while importing; only one import or sync runs at a time.',
			'Google Sheet auto-sync (every 15 minutes, hourly, …): publishes a product as soon as its row has an Affiliate Link.',
			'"Clean up duplicates" button.',
		) ),
		'1.3.0' => array( '3 Nov 2026', array(
			'Importer reads your scraper\'s Excel (.xlsx) directly, using the scraper\'s column names.',
			'Title made from the product link when the title says "Image"; category guessed from the product name.',
			'Store link kept on each post so you can convert it in ExtraPe; it is never used as the Buy link.',
		) ),
		'1.2.0' => array( '3 Nov 2026', array(
			'Flipkart-style homepage: top-left switcher (Adyzio, Shopping, Travel, Finance, Hosting, Services), category icon bar, banner carousel.',
			'Deals of the Day, "Best of" panels, Shop by budget, Top stores, partner pages for Travel, Finance and Hosting.',
			'Category pages with breadcrumbs and filters; custom banners; theme header hidden on the homepage.',
		) ),
		'1.1.0' => array( '3 Nov 2026', array(
			'Telegram and WhatsApp channels built in; social links (Instagram, Facebook, YouTube, X, Pinterest, Reddit, Threads).',
			'A row of the 10 newest products for every category; bulk CSV import (Tools → Adyzio Import).',
		) ),
		'1.0.0' => array( '3 Nov 2026', array(
			'First version: homepage from the "Adyzio Deals" design, Deal details box in the post editor, Buy Now box on posts.',
			'Store directory, share buttons (WhatsApp, Telegram, email, copy link), Telugu switch, 24-hour price rule.',
		) ),
	);
}

/** The "version" box at the top of Settings → Adyzio. */
function adyzio_version_box() {
	$log = adyzio_changelog();
	?>
	<div style="background:#fff;border:1px solid #dcdcde;border-left:4px solid #2a2470;border-radius:8px;padding:12px 16px;margin:12px 0 18px;max-width:900px">
		<p style="margin:0 0 6px;font-size:15px">You are running <strong>Adyzio Core <?php echo esc_html( ADYZIO_VERSION ); ?></strong>. When you upload a new zip, its file name shows the version (for example <code>adyzio-core-1.6.0.zip</code>); the number here changes after the upload.</p>
		<details>
			<summary style="cursor:pointer;font-weight:600">What changed in each version</summary>
			<?php foreach ( $log as $ver => $info ) : ?>
				<p style="margin:12px 0 4px"><strong><?php echo esc_html( $ver ); ?></strong><?php echo ADYZIO_VERSION === $ver ? ' <span style="background:#e2f4ea;color:#16794a;border-radius:4px;padding:1px 6px;font-size:12px">installed</span>' : ''; ?></p>
				<ul style="list-style:disc;padding-left:20px;margin:0">
					<?php foreach ( $info[1] as $line ) : ?><li><?php echo esc_html( $line ); ?></li><?php endforeach; ?>
				</ul>
			<?php endforeach; ?>
		</details>
	</div>
	<?php
}
