<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Telugu names for the standard Adyzio categories (others show their English name). */
function adyzio_cat_te() {
	return array(
		'deals'        => 'ఈరోజు డీల్స్',
		'mobiles'      => 'మొబైల్స్',
		'student'      => 'విద్యార్థులు',
		'electronics'  => 'ఎలక్ట్రానిక్స్',
		'home-kitchen' => 'ఇల్లు & వంటగది',
		'fashion'      => 'ఫ్యాషన్',
		'appliances'     => 'అప్లయెన్సెస్',
		'grocery'        => 'కిరాణా',
		'beauty'         => 'బ్యూటీ & పర్సనల్ కేర్',
		'toys-baby'      => 'బొమ్మలు & బేబీ',
		'sports-fitness' => 'స్పోర్ట్స్ & ఫిట్‌నెస్',
		'two-wheelers'   => 'టూ వీలర్స్ & ఆటో',
		'mobiles-and-tablets'                   => 'మొబైల్స్ & ట్యాబ్లెట్స్',
		'computers-and-accessories'             => 'కంప్యూటర్లు & యాక్సెసరీస్',
		'fashion-men'                           => 'పురుషుల ఫ్యాషన్',
		'fashion-women'                         => 'మహిళల ఫ్యాషన్',
		'kids-baby-and-toys'                    => 'పిల్లలు, బేబీ & బొమ్మలు',
		'beauty-and-personal-care'              => 'బ్యూటీ & పర్సనల్ కేర్',
		'home-and-kitchen'                      => 'ఇల్లు & వంటగది',
		'home-appliances'                       => 'గృహోపకరణాలు',
		'health-and-wellness'                   => 'ఆరోగ్యం & వెల్‌నెస్',
		'sports-and-fitness'                    => 'స్పోర్ట్స్ & ఫిట్‌నెస్',
		'grocery-and-gourmet'                   => 'కిరాణా',
		'books-and-stationery'                  => 'పుస్తకాలు & స్టేషనరీ',
		'automotive'                            => 'వాహనాలు',
		'jewellery-and-watches'                 => 'ఆభరణాలు & వాచీలు',
		'bags-luggage-and-travel'               => 'బ్యాగులు & ప్రయాణం',
		'pet-supplies'                          => 'పెంపుడు జంతువులు',
		'office-and-industrial'                 => 'ఆఫీస్ & ఇండస్ట్రియల్',
		'musical-instruments-and-entertainment' => 'సంగీత వాయిద్యాలు & వినోదం',
		'gifts-and-special-occasions'           => 'బహుమతులు & ప్రత్యేక సందర్భాలు',
	);
}

/** One post as a deal object for the homepage script. */
function adyzio_deal_data( $post ) {
	$id   = $post->ID;
	$m    = function ( $k ) use ( $id ) {
		return get_post_meta( $id, $k, true );
	};
	$cats = get_the_category( $id );
	$img  = $m( 'image_url' );
	if ( ! $img && has_post_thumbnail( $id ) ) {
		$img = get_the_post_thumbnail_url( $id, 'medium' );
	}
	$good = $m( 'good_for' );
	if ( ! $good ) {
		$good = wp_trim_words( wp_strip_all_tags( get_the_excerpt( $post ) ), 16, '…' );
	}
	$check = array_values( array_filter( array_map( 'trim', preg_split( '/\r\n|\r|\n/', (string) $m( 'check_list' ) ) ) ) );
	$price = $m( 'price' );
	$mrp   = $m( 'mrp' );
	$ends  = (int) $m( 'deal_ends' );
	$chk   = (int) $m( 'price_checked' );

	/* Every category of the post plus all their parent categories, so a deal in "Earbuds" also shows under "Electronics". */
	$all_cats = array();
	foreach ( $cats as $c ) {
		$all_cats[] = $c->slug;
		foreach ( get_ancestors( $c->term_id, 'category', 'taxonomy' ) as $aid ) {
			$a = get_term( $aid, 'category' );
			if ( $a && ! is_wp_error( $a ) ) {
				$all_cats[] = $a->slug;
			}
		}
	}

	return array(
		'id'      => $id,
		't'       => html_entity_decode( get_the_title( $id ), ENT_QUOTES, 'UTF-8' ),
		'url'     => get_permalink( $id ),
		'cat'     => $cats ? $cats[0]->slug : '',
		'cats'    => array_values( array_unique( $all_cats ) ),
		's'       => adyzio_store_key( $m( 'store' ) ),
		'link'    => (string) $m( 'buy_link' ),
		'type'    => (string) $m( 'deal_type' ),
		'img'     => $img ? (string) $img : '',
		'good'    => html_entity_decode( (string) $good, ENT_QUOTES, 'UTF-8' ),
		'check'   => $check,
		'price'   => '' === $price ? null : (int) $price,
		'mrp'     => '' === $mrp ? null : (int) $mrp,
		'checked' => $chk ? $chk * 1000 : null,
		'ends'    => $ends ? $ends * 1000 : null,
		'date'    => get_post_time( 'U', true, $id ) * 1000,
		'pin'     => is_sticky( $id ),
	);
}

/** Latest published posts as deals. */
function adyzio_deals( $limit = 200 ) {
	$posts = get_posts( array(
		'post_type'           => 'post',
		'post_status'         => 'publish',
		'posts_per_page'      => $limit,
		'ignore_sticky_posts' => true,
		'no_found_rows'       => true,
	) );
	return array_map( 'adyzio_deal_data', $posts );
}

/** Everything the homepage script needs. */
function adyzio_home_data() {
	$deals  = adyzio_deals();
	$stores = adyzio_stores();
	$links  = adyzio_store_links();
	$s      = adyzio_settings();

	/* Only send stores that are useful on the page: top stores, stores with a link, stores with a deal. */
	$need = array_flip( adyzio_top_stores() );
	foreach ( $links as $k => $u ) {
		$need[ $k ] = 1;
	}
	foreach ( $deals as $d ) {
		if ( $d['s'] ) {
			$need[ $d['s'] ] = 1;
		}
	}
	$out_stores = array();
	foreach ( $need as $k => $_ ) {
		if ( isset( $stores[ $k ] ) ) {
			$st = $stores[ $k ];
			if ( ! empty( $st['logo'] ) ) {
				$st['logo'] = ADYZIO_URL . 'assets/logos/' . rawurlencode( $st['logo'] );
			}
			$st['link']   = $links[ $k ] ?? '';
			$st['v']      = adyzio_store_vertical( $st );
			$out_stores[] = $st;
		}
	}

	/* How many stores each section could have (for the admin tip on empty sections). */
	$vcount = array();
	foreach ( $stores as $st ) {
		$v            = adyzio_store_vertical( $st );
		$vcount[ $v ] = ( $vcount[ $v ] ?? 0 ) + 1;
	}

	/* Categories as [slug, English name, Telugu name, parent slug, link]. "Today's Deals" goes first, the rest A–Z. */
	$te    = adyzio_cat_te();
	$terms = get_terms( array( 'taxonomy' => 'category', 'hide_empty' => false, 'orderby' => 'name' ) );
	$cats  = array();
	if ( ! is_wp_error( $terms ) ) {
		$by_id = array();
		foreach ( $terms as $t ) {
			$by_id[ $t->term_id ] = $t;
		}
		/* order and Telugu names follow the Adyzio list; categories reused from earlier versions keep their old slug, so look them up by id too */
		$order = adyzio_category_order();
		$listslug = array();
		foreach ( (array) get_option( 'adyzio_catmap', array() ) as $lslug => $tid ) {
			$listslug[ (int) $tid ] = $lslug;
		}
		$key = function ( $t ) use ( $listslug ) {
			return $listslug[ $t->term_id ] ?? $t->slug;
		};
		usort( $terms, function ( $a, $b ) use ( $order, $key ) {
			$oa = $order[ $key( $a ) ] ?? 9999;
			$ob = $order[ $key( $b ) ] ?? 9999;
			return ( $oa <=> $ob ) ?: strcasecmp( $a->name, $b->name );
		} );
		foreach ( $terms as $t ) {
			$name   = html_entity_decode( $t->name, ENT_QUOTES, 'UTF-8' );
			$parent = ( $t->parent && isset( $by_id[ $t->parent ] ) ) ? $by_id[ $t->parent ]->slug : '';
			$cats[] = array( $t->slug, $name, $te[ $key( $t ) ] ?? ( $te[ $t->slug ] ?? $name ), $parent );
		}
	}

	return array(
		'deals'    => $deals,
		'stores'   => $out_stores,
		'top'      => adyzio_top_stores(),
		'cats'     => $cats,
		'telegram' => $s['telegram'],
		'whatsapp' => $s['whatsapp'],
		'perRow'   => 10,
		'site'     => home_url( '/' ),
		'verts'    => adyzio_verticals(),
		'vcount'   => $vcount,
		'banners'  => adyzio_banners(),
		'isAdmin'  => current_user_can( 'manage_options' ),
		'setUrl'   => admin_url( 'options-general.php?page=adyzio' ),
		'ajax'     => admin_url( 'admin-ajax.php' ),
	);
}

/* Category pages and search ask for more products than the first 200 the homepage loads. Public, read-only, published posts only. */
function adyzio_ajax_list() {
	$cat = isset( $_GET['cat'] ) ? sanitize_title( wp_unslash( $_GET['cat'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
	$q   = isset( $_GET['q'] ) ? sanitize_text_field( wp_unslash( $_GET['q'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
	$args = array(
		'post_type'           => 'post',
		'post_status'         => 'publish',
		'posts_per_page'      => 300,
		'ignore_sticky_posts' => true,
		'no_found_rows'       => true,
	);
	if ( $cat && 'all' !== $cat ) {
		$args['tax_query'] = array( array( 'taxonomy' => 'category', 'field' => 'slug', 'terms' => $cat, 'include_children' => true ) ); // phpcs:ignore WordPress.DB.SlowDBQuery
	}
	if ( '' !== $q ) {
		$args['s'] = $q;
	}
	if ( ! isset( $args['tax_query'] ) && ! isset( $args['s'] ) ) {
		wp_send_json( array( 'deals' => array() ) );
	}
	nocache_headers();
	wp_send_json( array( 'deals' => array_map( 'adyzio_deal_data', get_posts( $args ) ) ) );
}
add_action( 'wp_ajax_adyzio_list', 'adyzio_ajax_list' );
add_action( 'wp_ajax_nopriv_adyzio_list', 'adyzio_ajax_list' );
