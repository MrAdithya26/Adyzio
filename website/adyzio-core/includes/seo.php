<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/*
 * Rank Math SEO for product posts.
 *   SEO title ........ the product name as it is (%title%)
 *   Focus keyword .... short product name first, then "<name> price" and the child category name
 *   Meta description . product name + who it suits + store, under 160 characters
 *   URL slug ......... short product name (new posts only, so live links never change)
 * Fields you edit yourself in Rank Math are never overwritten: only empty fields, or fields Adyzio filled before, are updated.
 */

/** Short product name for the focus keyword and slug: drops text after | ( , – and keeps the first 7 words. */
function adyzio_seo_keyword( $title ) {
	$t = html_entity_decode( (string) $title, ENT_QUOTES, 'UTF-8' );
	$t = preg_split( '/\s[|(\[–—-]\s|\s*[|(\[,]/u', $t )[0];
	$t = trim( preg_replace( '/\s+/', ' ', $t ) );
	$w    = explode( ' ', $t );
	$keep = array_slice( $w, 0, 8 );
	$next = strtolower( $w[8] ?? '' );
	$last = end( $keep );
	if ( is_numeric( $last ) && preg_match( '/^(gb|tb|mb|l|ml|kg|g|mah|w|inch|inches|cm|mm|pcs|pack)$/', $next ) ) {
		$keep[] = $w[8]; /* keep "128 GB" together */
	} elseif ( count( $w ) > 8 ) {
		while ( count( $keep ) > 2 && is_numeric( end( $keep ) ) ) {
			array_pop( $keep ); /* don't end on a lone number */
		}
	}
	/* drop filler words left at the end by the cut ("… with 42H" → "…") */
	if ( count( $w ) > 8 ) {
		$cut = array_search( true, array_map( function ( $x ) { return in_array( strtolower( $x ), array( 'with', 'for', 'and', 'of', 'in', 'the', 'to', '&', '+' ), true ); }, $keep ), true );
		if ( false !== $cut && $cut >= 3 ) {
			$keep = array_slice( $keep, 0, $cut );
		}
	}
	return trim( implode( ' ', $keep ) );
}

/** The deepest category name of a post (e.g. "TWS Earbuds"). */
function adyzio_seo_cat_name( $post_id ) {
	$best = null;
	$deep = -1;
	foreach ( wp_get_post_categories( $post_id, array( 'fields' => 'all' ) ) as $t ) {
		$d = count( get_ancestors( $t->term_id, 'category', 'taxonomy' ) );
		if ( $d > $deep && 'deals' !== $t->slug && (int) get_option( 'default_category' ) !== (int) $t->term_id ) {
			$deep = $d;
			$best = $t;
		}
	}
	return $best ? html_entity_decode( $best->name, ENT_QUOTES, 'UTF-8' ) : '';
}

/** Store display name for a post. */
function adyzio_seo_store( $post_id ) {
	$k = adyzio_store_key( get_post_meta( $post_id, 'store', true ) );
	$s = adyzio_stores();
	return isset( $s[ $k ] ) ? $s[ $k ]['n'] : trim( (string) get_post_meta( $post_id, 'store', true ) );
}

/** Fill Rank Math fields for one post. $force = overwrite even fields someone edited by hand. Returns true if anything changed. */
function adyzio_seo_apply( $post_id, $force = false ) {
	$post = get_post( $post_id );
	if ( ! $post || 'post' !== $post->post_type ) {
		return false;
	}
	$auto  = (array) get_post_meta( $post_id, '_adz_seo_auto', true );
	$title = html_entity_decode( get_the_title( $post_id ), ENT_QUOTES, 'UTF-8' );
	$kw    = adyzio_seo_keyword( $title );
	if ( '' === $kw ) {
		return false;
	}
	$cat   = adyzio_seo_cat_name( $post_id );
	$store = adyzio_seo_store( $post_id );
	$good  = trim( (string) get_post_meta( $post_id, 'good_for', true ) );

	$keywords = array_unique( array_filter( array( strtolower( $kw ), strtolower( $kw ) . ' price', $cat ? strtolower( $cat ) : '' ) ) );
	$desc     = $kw . ( $good ? ' – good for ' . rtrim( $good, '.' ) . '.' : '.' ) . ' Check the latest price' . ( $store ? ' on ' . $store : '' ) . ' and buy on the store\'s own site.';
	if ( mb_strlen( $desc ) > 158 ) {
		$desc = rtrim( mb_substr( $desc, 0, 155 ), " ,.–-" ) . '…';
	}
	$want = array(
		'rank_math_title'         => '%title%',
		'rank_math_focus_keyword' => implode( ',', $keywords ),
		'rank_math_description'   => $desc,
	);
	$changed = false;
	foreach ( $want as $k => $v ) {
		$cur = (string) get_post_meta( $post_id, $k, true );
		if ( $force || '' === $cur || ( ! empty( $auto[ $k ] ) && $auto[ $k ] === md5( $cur ) ) ) {
			if ( $cur !== $v ) {
				update_post_meta( $post_id, $k, $v );
				$changed = true;
			}
			$auto[ $k ] = md5( $v );
		}
	}
	update_post_meta( $post_id, '_adz_seo_auto', $auto );
	return $changed;
}

/** For imported products with no text: one honest paragraph (no invented specs), so the page isn't empty and the keyword appears in the content. */
function adyzio_seo_intro( $post_id ) {
	$post = get_post( $post_id );
	if ( ! $post || '' !== trim( wp_strip_all_tags( $post->post_content ) ) ) {
		return;
	}
	$title = html_entity_decode( get_the_title( $post_id ), ENT_QUOTES, 'UTF-8' );
	$store = adyzio_seo_store( $post_id );
	$good  = trim( (string) get_post_meta( $post_id, 'good_for', true ) );
	$cat   = adyzio_seo_cat_name( $post_id );
	$text  = esc_html( $title ) . ( $store ? ' is available on ' . esc_html( $store ) . '.' : '.' )
		. ( $good ? ' Good for: ' . esc_html( rtrim( $good, '.' ) ) . '.' : '' )
		. ( $cat ? ' Find more ' . esc_html( strtolower( $cat ) ) . ' deals on Adyzio.' : '' )
		. ' Prices and offers change often, so check the latest price on the store page before you buy.';
	wp_update_post( array( 'ID' => $post_id, 'post_content' => "<!-- wp:paragraph -->\n<p>" . $text . "</p>\n<!-- /wp:paragraph -->" ) );
}

/* Saving a post in the editor fills any empty Rank Math fields (runs after the Deal details box saves). */
add_action( 'save_post_post', function ( $post_id ) {
	if ( wp_is_post_revision( $post_id ) || ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) ) {
		return;
	}
	if ( get_post_meta( $post_id, 'buy_link', true ) || get_post_meta( $post_id, 'product_link', true ) ) {
		remove_action( 'save_post_post', __FUNCTION__ );
		adyzio_seo_apply( $post_id );
	}
}, 20 );

/* Bulk: apply to every product post, in batches, with progress (Tools → Adyzio Import). */
add_action( 'wp_ajax_adyzio_seo_step', function () {
	if ( ! current_user_can( 'edit_others_posts' ) || ! check_ajax_referer( 'adyzio_import', 'nonce', false ) ) {
		wp_send_json( array( 'error' => 'Not allowed. Reload the page and try again.' ) );
	}
	$offset = isset( $_POST['offset'] ) ? absint( $_POST['offset'] ) : 0;
	$force  = ! empty( $_POST['force'] );
	$intro  = ! empty( $_POST['intro'] );
	$q      = new WP_Query( array(
		'post_type'      => 'post',
		'post_status'    => array( 'publish', 'draft', 'pending', 'future' ),
		'posts_per_page' => 50,
		'offset'         => $offset,
		'fields'         => 'ids',
		'orderby'        => 'ID',
		'order'          => 'ASC',
		'meta_query'     => array( 'relation' => 'OR', array( 'key' => 'buy_link', 'compare' => 'EXISTS' ), array( 'key' => 'product_link', 'compare' => 'EXISTS' ) ), // phpcs:ignore WordPress.DB.SlowDBQuery
	) );
	$changed = 0;
	$snap    = function ( $pid ) {
		return md5( get_post_field( 'post_content', $pid ) . '|' . get_post_meta( $pid, 'rank_math_title', true ) . '|' . get_post_meta( $pid, 'rank_math_focus_keyword', true ) . '|' . get_post_meta( $pid, 'rank_math_description', true ) );
	};
	foreach ( $q->posts as $pid ) {
		$before = $snap( $pid );
		if ( $intro ) {
			adyzio_seo_intro( $pid );
		}
		adyzio_seo_apply( $pid, $force );
		if ( $snap( $pid ) !== $before ) {
			$changed++;
		}
	}
	$next = $offset + count( $q->posts );
	wp_send_json( array( 'next' => $next, 'total' => (int) $q->found_posts, 'changed' => $changed, 'done' => $next >= (int) $q->found_posts ) );
} );
