<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* Styles for the "Follow Adyzio" pills, used on every page. */
add_action( 'wp_head', function () {
	?>
<style id="adyzio-social">
.adz-social{display:flex;flex-wrap:wrap;gap:8px}
.adz-social a{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid #E3E1EE;border-radius:999px;background:#fff;color:#1B1840;font-weight:600;font-size:13px;text-decoration:none;line-height:1.2}
.adz-social a:hover{border-color:var(--c);color:var(--c)}
.adz-sdot{width:10px;height:10px;border-radius:50%;background:var(--c);flex:none}
.adz-sitefollow{max-width:1140px;margin:0 auto;padding:18px 16px 6px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px 14px;font-family:inherit}
.adz-sitefollow strong{color:#1B1840;font-size:14px}
</style>
	<?php
} );

/* "Follow Adyzio" row at the bottom of every page except the homepage (which has its own). Runs before the disclosure line. */
add_action( 'wp_footer', function () {
	if ( is_front_page() ) {
		return;
	}
	$html = adyzio_social_html();
	if ( $html ) {
		echo '<div class="adz-sitefollow"><strong>Follow Adyzio</strong>' . $html . '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside
	}
}, 4 );
