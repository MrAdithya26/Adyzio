<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Social networks shown in the "Follow Adyzio" row: key => [label, brand colour]. */
function adyzio_social_networks() {
	return array(
		'telegram'  => array( 'Telegram', '#229ED9' ),
		'whatsapp'  => array( 'WhatsApp', '#1FA855' ),
		'instagram' => array( 'Instagram', '#D62976' ),
		'facebook'  => array( 'Facebook', '#1877F2' ),
		'youtube'   => array( 'YouTube', '#E62117' ),
		'x'         => array( 'X (Twitter)', '#111111' ),
		'pinterest' => array( 'Pinterest', '#C8232C' ),
		'reddit'    => array( 'Reddit', '#FF4500' ),
		'threads'   => array( 'Threads', '#111111' ),
	);
}

/** Plugin settings with defaults. Telegram and WhatsApp fall back to the Adyzio channels. */
function adyzio_settings() {
	$s = get_option( 'adyzio_settings', array() );
	$s = is_array( $s ) ? $s : array();
	$defaults = array(
		'telegram'    => 'https://t.me/adyzio',
		'whatsapp'    => 'https://whatsapp.com/channel/0029VapRLjsJZg4C6LzGti0d',
		'store_links' => '',
		'banners'     => '',
	);
	foreach ( adyzio_social_networks() as $k => $_ ) {
		if ( ! isset( $defaults[ $k ] ) ) {
			$defaults[ $k ] = '';
		}
	}
	$out = wp_parse_args( $s, $defaults );
	foreach ( array( 'telegram', 'whatsapp' ) as $k ) {
		if ( '' === trim( (string) $out[ $k ] ) ) {
			$out[ $k ] = $defaults[ $k ];
		}
	}
	return $out;
}

/** Filled-in social links as key => url, in display order. */
function adyzio_social_links() {
	$s   = adyzio_settings();
	$out = array();
	foreach ( adyzio_social_networks() as $k => $_ ) {
		$u = esc_url_raw( trim( (string) ( $s[ $k ] ?? '' ) ) );
		if ( $u ) {
			$out[ $k ] = $u;
		}
	}
	return $out;
}

/** "Follow Adyzio" pills. */
function adyzio_social_html( $class = '' ) {
	$nets  = adyzio_social_networks();
	$links = adyzio_social_links();
	if ( ! $links ) {
		return '';
	}
	$h = '<div class="adz-social ' . esc_attr( $class ) . '">';
	foreach ( $links as $k => $u ) {
		$h .= '<a href="' . esc_url( $u ) . '" target="_blank" rel="noopener me" style="--c:' . esc_attr( $nets[ $k ][1] ) . '"><span class="adz-sdot" aria-hidden="true"></span>' . esc_html( $nets[ $k ][0] ) . '</a>';
	}
	return $h . '</div>';
}

/** All stores from assets/stores.json, keyed by store key. Cached per request. */
function adyzio_stores() {
	static $stores = null;
	if ( null !== $stores ) {
		return $stores;
	}
	$stores = array();
	$file   = ADYZIO_DIR . 'assets/stores.json';
	if ( is_readable( $file ) ) {
		$list = json_decode( (string) file_get_contents( $file ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		if ( is_array( $list ) ) {
			foreach ( $list as $s ) {
				if ( ! empty( $s['k'] ) ) {
					$stores[ $s['k'] ] = $s;
				}
			}
		}
	}
	return $stores;
}

/**
 * Turn whatever was typed in the Store field ("Amazon", "Tata CLiQ", "flipkart") into a store key.
 */
function adyzio_store_key( $value ) {
	$value = trim( (string) $value );
	if ( '' === $value ) {
		return '';
	}
	$stores = adyzio_stores();
	$slug   = sanitize_title( $value );
	if ( isset( $stores[ $slug ] ) ) {
		return $slug;
	}
	$flat = preg_replace( '/[^a-z0-9]/', '', strtolower( $value ) );
	foreach ( $stores as $k => $s ) {
		if ( preg_replace( '/[^a-z0-9]/', '', strtolower( $s['n'] ) ) === $flat || str_replace( '-', '', $k ) === $flat ) {
			return $k;
		}
	}
	return $slug;
}

/** Store links from Settings → Adyzio, as key => url. */
function adyzio_store_links() {
	$out   = array();
	$lines = preg_split( '/\r\n|\r|\n/', (string) adyzio_settings()['store_links'] );
	foreach ( $lines as $line ) {
		if ( false === strpos( $line, '=' ) ) {
			continue;
		}
		list( $name, $url ) = array_map( 'trim', explode( '=', $line, 2 ) );
		$key = adyzio_store_key( $name );
		$url = esc_url_raw( $url );
		if ( $key && $url ) {
			$out[ $key ] = $url;
		}
	}
	return $out;
}

/**
 * Top-left switcher sections: key => [English, Telugu, button label EN, button label TE].
 * "main" is the full Adyzio homepage.
 */
function adyzio_verticals() {
	return array(
		'main'     => array( 'Adyzio', 'Adyzio', 'Visit Store', 'Store చూడండి' ),
		'shopping' => array( 'Shopping', 'షాపింగ్', 'Visit Store', 'Store చూడండి' ),
		'travel'   => array( 'Travel', 'ప్రయాణం', 'Book Now', 'బుక్ చేయండి' ),
		'finance'  => array( 'Finance', 'ఫైనాన్స్', 'View Offer', 'ఆఫర్ చూడండి' ),
		'hosting'  => array( 'Hosting', 'హోస్టింగ్', 'Get Deal', 'డీల్ పొందండి' ),
		'services' => array( 'Services', 'సేవలు', 'Visit Store', 'Store చూడండి' ),
	);
}

/** Which section a store belongs to (shopping, travel, finance, hosting, services). */
function adyzio_store_vertical( $store ) {
	$k = $store['k'] ?? '';
	$n = strtolower( $store['n'] ?? '' );
	if ( in_array( $k, array( 'hostinger', 'godaddy', 'bigrock' ), true ) || preg_match( '/host|domain|vps|server/', $n ) ) {
		return 'hosting';
	}
	$g = $store['g'] ?? 'shopping';
	return in_array( $g, array( 'travel', 'finance', 'services' ), true ) ? $g : 'shopping';
}

/**
 * Custom homepage banners from Settings → Adyzio, one per line:
 * section | headline | short text | button text | link
 * Sections without custom lines use the built-in banners.
 */
function adyzio_banners() {
	$out   = array();
	$verts = adyzio_verticals();
	foreach ( preg_split( '/\r\n|\r|\n/', (string) ( adyzio_settings()['banners'] ?? '' ) ) as $line ) {
		$parts = array_map( 'trim', explode( '|', $line ) );
		if ( count( $parts ) < 2 || '' === $parts[1] ) {
			continue;
		}
		$v = strtolower( $parts[0] );
		if ( ! isset( $verts[ $v ] ) ) {
			continue;
		}
		$link = $parts[4] ?? '';
		if ( '' !== $link && 0 !== strpos( $link, '#' ) && ! in_array( strtolower( $link ), array( 'telegram', 'whatsapp' ), true ) ) {
			$link = esc_url_raw( $link );
		}
		$out[] = array(
			'v' => $v,
			'h' => sanitize_text_field( $parts[1] ),
			'p' => sanitize_text_field( $parts[2] ?? '' ),
			'b' => sanitize_text_field( $parts[3] ?? '' ),
			'u' => $link,
		);
	}
	return $out;
}

/** The Adyzio category list (assets/categories.json): each entry is [name, slug, parent slug]. Parents come before children. */
function adyzio_category_list() {
	static $list = null;
	if ( null === $list ) {
		$list = json_decode( (string) file_get_contents( ADYZIO_DIR . 'assets/categories.json' ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		$list = is_array( $list ) ? $list : array();
	}
	return $list;
}

/** slug => position in the list (used to order the category bar and menus). */
function adyzio_category_order() {
	static $o = null;
	if ( null === $o ) {
		$o = array();
		foreach ( adyzio_category_list() as $i => $c ) {
			$o[ $c[1] ] = $i;
		}
	}
	return $o;
}

/**
 * Install part of the category list (so big lists don't time out). Existing categories are reused:
 * first by slug, then by the same name under the same parent, so nothing is created twice.
 * Returns array( added, reused, next, total ).
 */
function adyzio_install_categories( $offset = 0, $limit = 0 ) {
	$list  = adyzio_category_list();
	$total = count( $list );
	$limit = $limit ? $limit : $total;
	$map   = (array) get_option( 'adyzio_catmap', array() );
	$added = 0;
	$reuse = 0;
	$end   = min( $total, $offset + $limit );
	wp_defer_term_counting( true );
	for ( $i = $offset; $i < $end; $i++ ) {
		list( $name, $slug, $parent ) = $list[ $i ];
		$pid = $parent ? (int) ( $map[ $parent ] ?? 0 ) : 0;
		if ( $parent && ! $pid ) {
			$pt  = get_term_by( 'slug', $parent, 'category' );
			$pid = $pt ? (int) $pt->term_id : 0;
		}
		$id   = 0;
		$term = get_term_by( 'slug', $slug, 'category' );
		if ( $term ) {
			$id = (int) $term->term_id;
		} else {
			$same = get_terms( array( 'taxonomy' => 'category', 'name' => $name, 'parent' => $pid, 'hide_empty' => false, 'number' => 1, 'fields' => 'ids' ) );
			if ( ! is_wp_error( $same ) && $same ) {
				$id = (int) $same[0];
			}
		}
		if ( $id ) {
			$reuse++;
		} else {
			$new = wp_insert_term( $name, 'category', array( 'slug' => $slug, 'parent' => $pid ) );
			if ( is_wp_error( $new ) ) {
				$id = (int) $new->get_error_data( 'term_exists' );
			} else {
				$id = (int) $new['term_id'];
				$added++;
			}
		}
		if ( $id ) {
			$map[ $slug ] = $id;
		}
	}
	wp_defer_term_counting( false );
	update_option( 'adyzio_catmap', $map, false );
	return array( 'added' => $added, 'reused' => $reuse, 'next' => $end, 'total' => $total );
}

/** Old starter categories (from earlier versions) → where their deals go in the new list. */
function adyzio_old_category_map() {
	return array(
		'smartphones' => 'mobiles-and-tablets-smartphones',
		'chargers-cables' => 'mobiles-and-tablets-mobile-accessories-chargers-and-adapters',
		'power-banks' => 'mobiles-and-tablets-mobile-accessories-power-banks',
		'mobile-cases-covers' => 'mobiles-and-tablets-mobile-accessories-back-covers-and-cases',
		'laptops' => 'computers-and-accessories-computers-laptops',
		'headphones-earbuds' => 'electronics-audio',
		'smartwatches' => 'electronics-wearables-smart-watches',
		'speakers' => 'electronics-audio-bluetooth-speakers',
		'cameras' => 'electronics-cameras-and-photography',
		'computer-accessories' => 'computers-and-accessories-computer-accessories',
		'mens-clothing' => 'fashion-men-clothing',
		'womens-clothing' => 'fashion-women-western-wear',
		'kids-clothing' => 'kids-baby-and-toys',
		'footwear' => 'fashion-men-footwear',
		'watches-accessories' => 'jewellery-and-watches',
		'cookware' => 'home-and-kitchen-kitchen-and-dining-cookware',
		'kitchen-tools' => 'home-and-kitchen-kitchen-and-dining-kitchen-tools',
		'home-decor' => 'home-and-kitchen-home-decor',
		'furniture' => 'home-and-kitchen-furniture',
		'bed-bath' => 'home-and-kitchen-home-furnishing',
		'storage' => 'home-and-kitchen-home-storage-and-organisation',
		'televisions' => 'home-appliances-large-appliances-televisions',
		'washing-machines' => 'home-appliances-large-appliances-washing-machines',
		'refrigerators' => 'home-appliances-large-appliances-refrigerators',
		'air-conditioners' => 'home-appliances-large-appliances-air-conditioners',
		'fans-coolers' => 'home-appliances-small-home-appliances',
		'kitchen-appliances' => 'home-appliances-kitchen-appliances',
		'staples' => 'grocery-and-gourmet-staples',
		'snacks-beverages' => 'grocery-and-gourmet-food-and-snacks',
		'dry-fruits' => 'grocery-and-gourmet-food-and-snacks-dry-fruits-and-nuts',
		'household-supplies' => 'grocery-and-gourmet',
		'skincare' => 'beauty-and-personal-care-skincare',
		'makeup' => 'beauty-and-personal-care-makeup',
		'haircare' => 'beauty-and-personal-care-haircare',
		'mens-grooming' => 'beauty-and-personal-care-grooming',
		'fragrances' => 'beauty-and-personal-care-fragrances',
		'toys' => 'kids-baby-and-toys-toys-and-games',
		'baby-care' => 'kids-baby-and-toys-baby-and-infant',
		'kids-learning' => 'kids-baby-and-toys-toys-and-games-educational-toys',
		'fitness-equipment' => 'sports-and-fitness-fitness-equipment',
		'yoga' => 'sports-and-fitness-fitness-equipment-yoga-mats',
		'cycling' => 'sports-and-fitness-outdoor-and-activewear-cycling-accessories',
		'sports-gear' => 'sports-and-fitness-sports-equipment',
		'calculators' => 'books-and-stationery-stationery-calculators',
		'study-lamps' => 'books-and-stationery-stationery-school-accessories',
		'bags' => 'books-and-stationery-stationery-school-bags',
		'exam-books' => 'books-and-stationery-books-competitive-exam-books',
		'stationery' => 'books-and-stationery-stationery',
		'helmets' => 'automotive-bike-accessories-bike-helmets',
		'bike-accessories' => 'automotive-bike-accessories',
		'car-accessories' => 'automotive-car-accessories',
		'mobiles' => 'mobiles-and-tablets',
		'fashion' => 'fashion-men',
		'home-kitchen' => 'home-and-kitchen',
		'appliances' => 'home-appliances',
		'grocery' => 'grocery-and-gourmet',
		'beauty' => 'beauty-and-personal-care',
		'toys-baby' => 'kids-baby-and-toys',
		'sports-fitness' => 'sports-and-fitness',
		'student' => 'books-and-stationery',
		'two-wheelers' => 'automotive',
	);
}

/**
 * Move deals out of the old starter categories into the new list, then remove the old categories that are now empty.
 * Only the starter categories listed above are touched, and never the default category.
 */
function adyzio_migrate_old_categories() {
	$map     = (array) get_option( 'adyzio_catmap', array() );
	$default = (int) get_option( 'default_category' );
	$moved   = 0;
	$removed = 0;
	foreach ( adyzio_old_category_map() as $old_slug => $new_slug ) {
		$old = get_term_by( 'slug', $old_slug, 'category' );
		$nid = (int) ( $map[ $new_slug ] ?? 0 );
		if ( ! $nid ) {
			$nt  = get_term_by( 'slug', $new_slug, 'category' );
			$nid = $nt ? (int) $nt->term_id : 0;
		}
		if ( ! $old || ! $nid || (int) $old->term_id === $nid || (int) $old->term_id === $default ) {
			continue;
		}
		$posts = get_posts( array(
			'post_type'      => 'post',
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'tax_query'      => array( array( 'taxonomy' => 'category', 'field' => 'term_id', 'terms' => (int) $old->term_id, 'include_children' => false ) ), // phpcs:ignore WordPress.DB.SlowDBQuery
		) );
		foreach ( $posts as $pid ) {
			$cats = array_diff( wp_get_post_categories( $pid ), array( (int) $old->term_id ) );
			$cats[] = $nid;
			wp_set_post_categories( $pid, array_values( array_unique( $cats ) ) );
			$moved++;
		}
		$kids = get_terms( array( 'taxonomy' => 'category', 'parent' => (int) $old->term_id, 'hide_empty' => false, 'fields' => 'ids' ) );
		if ( ! is_wp_error( $kids ) && ! $kids && ! is_wp_error( wp_delete_term( (int) $old->term_id, 'category' ) ) ) {
			$removed++;
		}
	}
	/* imported products that are still drafts: sort them again with the new, more detailed list */
	$resorted = 0;
	if ( function_exists( 'adyzio_guess_category' ) ) {
		$drafts = get_posts( array( 'post_type' => 'post', 'post_status' => array( 'draft', 'pending' ), 'posts_per_page' => -1, 'fields' => 'ids', 'meta_key' => 'product_link' ) ); // phpcs:ignore WordPress.DB.SlowDBQuery
		foreach ( $drafts as $pid ) {
			$link = (string) get_post_meta( $pid, 'product_link', true );
			$path = adyzio_guess_category( get_the_title( $pid ) . ' ' . str_replace( '-', ' ', (string) wp_parse_url( $link, PHP_URL_PATH ) ) );
			$tid  = $path ? adyzio_term_for_path( $path ) : 0;
			if ( $tid && array( $tid ) !== wp_get_post_categories( $pid ) ) {
				wp_set_post_categories( $pid, array( $tid ) );
				$resorted++;
			}
		}
	}
	return array( 'moved' => $moved, 'removed' => $removed, 'resorted' => $resorted );
}

/** Stores shown first in the logo strip and directory. */
function adyzio_top_stores() {
	return array( 'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'shopsy', 'nykaa', 'tatacliq', 'croma', 'boat', 'jiomart', 'decathlon' );
}
