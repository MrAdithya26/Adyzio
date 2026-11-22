<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Deal box at the top of single posts that have a Buy link.
 * Priority 4 runs before the disclosure snippet (priority 5), so the disclosure stays on top.
 */
add_filter( 'the_content', function ( $content ) {
	if ( ! is_singular( 'post' ) || ! in_the_loop() || ! is_main_query() ) {
		return $content;
	}
	$id   = get_the_ID();
	$link = get_post_meta( $id, 'buy_link', true );
	if ( ! $link ) {
		return $content;
	}
	$d      = adyzio_deal_data( get_post( $id ) );
	$stores = adyzio_stores();
	$sname  = $d['s'] && isset( $stores[ $d['s'] ] ) ? $stores[ $d['s'] ]['n'] : trim( (string) get_post_meta( $id, 'store', true ) );

	$price = '';
	if ( $d['price'] && $d['checked'] ) {
		$off   = ( $d['mrp'] && $d['mrp'] > $d['price'] ) ? round( ( 1 - $d['price'] / $d['mrp'] ) * 100 ) : 0;
		$price = '<div class="adz-dprice" data-checked="' . esc_attr( $d['checked'] ) . '" hidden><b>₹' . esc_html( number_format_i18n( $d['price'] ) ) . '</b>'
			. ( $d['mrp'] ? ' <s>₹' . esc_html( number_format_i18n( $d['mrp'] ) ) . '</s>' : '' )
			. ( $off ? ' <span>' . (int) $off . '% off</span>' : '' )
			. '<small>Price checked ' . esc_html( wp_date( 'j M, g:i a', (int) ( $d['checked'] / 1000 ) ) ) . '. Confirm on the store page.</small></div>';
	}

	$box  = '<div class="adz-dealbox">';
	if ( $d['img'] ) {
		$box .= '<img src="' . esc_url( $d['img'] ) . '" alt="' . esc_attr( $d['t'] ) . '" loading="lazy">';
	}
	$box .= '<div>';
	if ( $sname ) {
		$box .= '<span class="adz-dstore">' . esc_html( $sname ) . '</span>';
	}
	if ( $d['good'] ) {
		$box .= '<p><strong>Good for:</strong> ' . esc_html( $d['good'] ) . '</p>';
	}
	$box .= $price . '<p class="adz-dcheck">Check latest price on the store page.</p>';
	$box .= '<a class="adz-dbuy" href="' . esc_url( $link ) . '" target="_blank" rel="sponsored nofollow noopener">Buy Now' . ( $sname ? ' on ' . esc_html( $sname ) : '' ) . '</a>';
	if ( $d['check'] ) {
		$box .= '<details><summary>Check before you buy</summary><ul>';
		foreach ( $d['check'] as $c ) {
			$box .= '<li>' . esc_html( $c ) . '</li>';
		}
		$box .= '</ul></details>';
	}
	$box .= '</div></div>';

	return $box . $content;
}, 4 );

add_action( 'wp_head', function () {
	if ( ! is_singular( 'post' ) ) {
		return;
	}
	?>
<style id="adyzio-dealbox">
.adz-dealbox{display:grid;grid-template-columns:140px 1fr;gap:16px;align-items:start;background:#fff;border:1px solid #E3E1EE;border-radius:14px;padding:14px;margin:0 0 20px}
.adz-dealbox img{width:140px;height:140px;object-fit:contain;background:#F7F6FB;border-radius:10px;padding:8px;box-sizing:border-box}
.adz-dealbox p{margin:6px 0}
.adz-dstore{display:inline-block;font-size:12px;font-weight:700;border:1px solid #E3E1EE;border-radius:6px;padding:2px 8px;color:#1B1840}
.adz-dprice{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin:6px 0}
.adz-dprice b{font-size:24px;color:#1B1840}
.adz-dprice s{color:#77739A}
.adz-dprice span{color:#16794A;font-weight:700}
.adz-dprice small{flex-basis:100%;color:#77739A;font-size:12px}
.adz-dcheck{font-weight:700;color:#2A2470}
.adz-dbuy{display:inline-block;background:#2A2470;color:#fff!important;font-weight:700;padding:11px 20px;border-radius:9px;text-decoration:none;margin:6px 0}
.adz-dbuy:hover{background:#1B1840}
.adz-dealbox details{margin-top:8px}
@media (max-width:520px){.adz-dealbox{grid-template-columns:1fr}.adz-dealbox img{width:100%;height:200px}}
</style>
	<?php
} );

/* Show the saved price only within 24 hours of the check (works even when the page is cached). */
add_action( 'wp_footer', function () {
	if ( ! is_singular( 'post' ) ) {
		return;
	}
	?>
<script>
document.querySelectorAll('.adz-dprice[data-checked]').forEach(function(el){
	if(Date.now()-Number(el.dataset.checked)<864e5){el.hidden=false;var n=el.parentNode.querySelector('.adz-dcheck');if(n)n.hidden=true;}
});
</script>
	<?php
} );
