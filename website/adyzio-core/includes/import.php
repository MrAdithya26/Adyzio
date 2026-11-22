<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/*
 * Tools → Adyzio Import: add many deals at once from your scraper's Excel file (.xlsx) or a CSV.
 *
 * Template columns (same order as the scraper sheet, then optional Adyzio columns):
 *   Sr No, Store, Product Title, Brand, Price (₹), MRP (₹), Discount %, Rating, Reviews, Product Link,
 *   Affiliate Link, Conversion, Image URL, Drive Image Link, Scraped At, Source Page,
 *   Category, Subcategory, Deal Type, Good For, Check List, Description, Ends
 *
 * Old Adyzio column names (title, buy_link, image_url, …) still work.
 * Ignored on purpose: Sr No, Discount % (worked out from price and MRP), Rating and Reviews (Adyzio doesn't show ratings),
 * Conversion, Source Page.
 */

/** Template header row. */
function adyzio_import_columns() {
	return array( 'Sr No', 'Store', 'Product Title', 'Brand', 'Price (₹)', 'MRP (₹)', 'Discount %', 'Rating', 'Reviews', 'Product Link', 'Affiliate Link', 'Conversion', 'Image URL', 'Drive Image Link', 'Scraped At', 'Source Page', 'Category', 'Subcategory', 'Child Category', 'Deal Type', 'Good For', 'Check List', 'Description', 'Ends' );
}

/** Header name (any spelling) → internal field. Headers are compared lowercase with only letters and digits. */
function adyzio_import_aliases() {
	return array(
		'producttitle' => 'title', 'title' => 'title', 'productname' => 'title', 'name' => 'title',
		'store' => 'store', 'brand' => 'brand',
		'price' => 'price', 'mrp' => 'mrp',
		'productlink' => 'product_link', 'producturl' => 'product_link',
		'affiliatelink' => 'buy_link', 'buylink' => 'buy_link', 'affiliateurl' => 'buy_link',
		'imageurl' => 'image_url', 'image' => 'image_url',
		'driveimagelink' => 'drive_image',
		'scrapedat' => 'scraped_at',
		'category' => 'category', 'maincategory' => 'category', 'subcategory' => 'subcategory', 'childcategory' => 'child', 'fullcategorypath' => 'cat_path', 'categorypath' => 'cat_path',
		'dealtype' => 'deal_type', 'goodfor' => 'good_for', 'checklist' => 'check_list',
		'description' => 'description', 'ends' => 'ends', 'dealends' => 'ends',
	);
}

function adyzio_import_norm_header( $h ) {
	$h = preg_replace( '/^\xEF\xBB\xBF/', '', (string) $h );
	return preg_replace( '/[^a-z0-9]/', '', strtolower( $h ) );
}

add_action( 'admin_menu', function () {
	add_management_page( 'Adyzio Import', 'Adyzio Import', 'edit_posts', 'adyzio-import', 'adyzio_import_page' );
} );

/* Template download (CSV, opens in Excel). */
add_action( 'admin_post_adyzio_csv_template', function () {
	if ( ! current_user_can( 'edit_posts' ) || ! check_admin_referer( 'adyzio_csv_template' ) ) {
		wp_die( 'Not allowed.' );
	}
	nocache_headers();
	header( 'Content-Type: text/csv; charset=utf-8' );
	header( 'Content-Disposition: attachment; filename=adyzio-deals-template.csv' );
	$out = fopen( 'php://output', 'w' ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	fwrite( $out, "\xEF\xBB\xBF" ); // phpcs:ignore WordPress.WP.AlternativeFunctions -- so Excel reads ₹ and Telugu correctly
	fputcsv( $out, adyzio_import_columns() );
	fputcsv( $out, array( '1', 'Flipkart', 'Example product name (replace this row)', 'BrandName', '', '', '', '', '', 'https://www.flipkart.com/product-name/p/itmxxxx', 'https://your-extrape-link', '', 'https://image-link-from-extrape.jpg', '', '', '', 'Mobiles & Tablets', 'Smartphones', '5G Smartphones', 'drop', 'Students and first-time 5G buyers', 'Bank offer terms|Which RAM/storage you are buying', 'One or two lines about the product.', '' ) );
	fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	exit;
} );

/* ---------------- reading files ---------------- */

/** Read the first sheet of an .xlsx file into rows of strings. Needs PHP's ZipArchive (standard on Hostinger). */
function adyzio_read_xlsx( $path ) {
	if ( ! class_exists( 'ZipArchive' ) ) {
		return new WP_Error( 'nozip', 'This server cannot open .xlsx files. In Excel, use File → Save As → "CSV UTF-8" and upload the CSV instead.' );
	}
	$zip = new ZipArchive();
	if ( true !== $zip->open( $path ) ) {
		return new WP_Error( 'badxlsx', 'Could not open this Excel file.' );
	}
	$shared = array();
	$ss     = $zip->getFromName( 'xl/sharedStrings.xml' );
	if ( $ss ) {
		$x = simplexml_load_string( $ss );
		if ( $x ) {
			foreach ( $x->si as $si ) {
				if ( isset( $si->t ) ) {
					$shared[] = (string) $si->t;
				} else {
					$t = '';
					foreach ( $si->r as $r ) {
						$t .= (string) $r->t;
					}
					$shared[] = $t;
				}
			}
		}
	}
	/* first worksheet listed in the workbook */
	$sheet = 'xl/worksheets/sheet1.xml';
	$rels  = $zip->getFromName( 'xl/_rels/workbook.xml.rels' );
	$wbx   = $zip->getFromName( 'xl/workbook.xml' );
	if ( $rels && $wbx ) {
		$w = simplexml_load_string( $wbx );
		$r = simplexml_load_string( $rels );
		if ( $w && $r && isset( $w->sheets->sheet[0] ) ) {
			$rid = (string) $w->sheets->sheet[0]->attributes( 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' )->id;
			foreach ( $r->Relationship as $rel ) {
				if ( (string) $rel['Id'] === $rid ) {
					$t     = ltrim( (string) $rel['Target'], '/' );
					$sheet = 0 === strpos( $t, 'xl/' ) ? $t : 'xl/' . $t;
				}
			}
		}
	}
	$xml = $zip->getFromName( $sheet );
	$zip->close();
	if ( ! $xml ) {
		return new WP_Error( 'nosheet', 'The Excel file has no readable sheet.' );
	}
	$x = simplexml_load_string( $xml );
	if ( ! $x ) {
		return new WP_Error( 'badsheet', 'The Excel sheet could not be read.' );
	}
	$rows = array();
	foreach ( $x->sheetData->row as $row ) {
		$cells = array();
		foreach ( $row->c as $c ) {
			$ref  = (string) $c['r'];
			$col  = 0;
			$letters = preg_replace( '/[^A-Z]/', '', $ref );
			for ( $i = 0, $n = strlen( $letters ); $i < $n; $i++ ) {
				$col = $col * 26 + ( ord( $letters[ $i ] ) - 64 );
			}
			$col  = max( 0, $col - 1 );
			$type = (string) $c['t'];
			if ( 's' === $type ) {
				$v = $shared[ (int) $c->v ] ?? '';
			} elseif ( 'inlineStr' === $type ) {
				$v = (string) $c->is->t;
			} else {
				$v = (string) $c->v;
			}
			$cells[ $col ] = $v;
		}
		if ( $cells ) {
			$max  = max( array_keys( $cells ) );
			$line = array();
			for ( $i = 0; $i <= $max; $i++ ) {
				$line[] = isset( $cells[ $i ] ) ? trim( $cells[ $i ] ) : '';
			}
			$rows[] = $line;
		}
	}
	return $rows;
}

function adyzio_read_csv( $path ) {
	$fh = fopen( $path, 'r' ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	if ( ! $fh ) {
		return new WP_Error( 'badcsv', 'Could not read the file.' );
	}
	$rows = array();
	while ( ( $r = fgetcsv( $fh ) ) !== false ) {
		$rows[] = array_map( 'trim', array_map( 'strval', $r ) );
	}
	fclose( $fh ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	return $rows;
}

/* ---------------- turning a row into a deal ---------------- */

/** Make a readable title from a store link like flipkart.com/nothing-phone-4b-white-128-gb/p/… */
function adyzio_title_from_link( $url ) {
	$path  = (string) wp_parse_url( $url, PHP_URL_PATH );
	$parts = array_values( array_filter( explode( '/', $path ) ) );
	$slug  = '';
	foreach ( $parts as $i => $p ) {
		if ( in_array( $p, array( 'p', 'dp', 'product', 'buy' ), true ) && $i > 0 ) {
			$slug = $parts[ $i - 1 ];
			break;
		}
	}
	if ( '' === $slug && $parts ) {
		$slug = $parts[0];
	}
	if ( '' === $slug || preg_match( '/^(itm|B0)[A-Za-z0-9]+$/', $slug ) ) {
		return '';
	}
	$upper = array( 'gb', 'tb', 'mb', 'led', 'lcd', 'tv', 'ac', 'usb', 'hd', 'fhd', 'uhd', 'qled', 'oled', 'ssd', 'hdd', 'ram', 'rom', 'bt', 'anc', 'tws', 'ipl' );
	$words = array_map( function ( $w ) use ( $upper ) {
		if ( in_array( $w, $upper, true ) || preg_match( '/^\d+[a-z]{1,2}$/', $w ) ) {
			return strtoupper( $w );
		}
		return ucfirst( $w );
	}, explode( '-', strtolower( rawurldecode( $slug ) ) ) );
	return trim( implode( ' ', $words ) );
}

/** Google Drive share link → direct image link (the file must be shared as "Anyone with the link"). */
function adyzio_drive_image( $url ) {
	if ( preg_match( '#drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:export=\w+&)?id=)([A-Za-z0-9_-]{20,})#', (string) $url, $m ) ) {
		return 'https://lh3.googleusercontent.com/d/' . $m[1];
	}
	return $url;
}

/** Scraped At like "3/11/2026, 12:53:50 pm" (day/month/year, India) → timestamp, or 0. */
function adyzio_parse_scraped_at( $s ) {
	$s = trim( (string) $s );
	if ( '' === $s ) {
		return 0;
	}
	if ( is_numeric( $s ) && (float) $s > 30000 && (float) $s < 80000 ) { /* Excel date number */
		return (int) round( ( (float) $s - 25569 ) * 86400 ) - (int) wp_timezone()->getOffset( new DateTime() );
	}
	foreach ( array( 'j/n/Y, g:i:s a', 'd/m/Y, g:i:s a', 'j/n/Y, H:i:s', 'd/m/Y H:i', 'Y-m-d H:i:s', 'Y-m-d H:i', 'Y-m-d' ) as $f ) {
		$d = DateTime::createFromFormat( $f, strtolower( $s ), wp_timezone() );
		if ( $d ) {
			return $d->getTimestamp();
		}
	}
	return 0;
}

/** Guess the category path (main, sub, child) from the product name. Returns array() when unsure. Most specific rules come first. */
function adyzio_guess_category( $text ) {
	$t     = ' ' . strtolower( (string) $text ) . ' ';
	$rules = array(
		array( '/\b(?:smart ?watch)/', 'Electronics > Wearables > Smart Watches' ),
		array( '/\b(?:fitness band|smart ?band)/', 'Electronics > Wearables > Fitness Bands' ),
		array( '/\b(?:smart ring)/', 'Electronics > Wearables > Smart Rings' ),
		array( '/\b(?:dhoop|incense|agarbatti)/', 'Home & Kitchen > Home Decor > Home Fragrances' ),
		array( '/\b(?:two wheeler cover|bike cover|scooty cover)/', 'Automotive > Bike Accessories > Bike Covers' ),
		array( '/\b(?:riding gloves)/', 'Automotive > Bike Accessories > Riding Gloves' ),
		array( '/\b(?:helmet)/', 'Automotive > Bike Accessories > Bike Helmets' ),
		array( '/\b(?:dash ?cam)/', 'Automotive > Car Accessories > Dash Cameras' ),
		array( '/\b(?:car charger)/', 'Automotive > Car Accessories > Car Chargers' ),
		array( '/\b(?:seat cover)/', 'Automotive > Car Accessories > Seat Covers' ),
		array( '/\b(?:car cover)/', 'Automotive > Car Accessories > Car Covers' ),
		array( '/\b(?:tyre inflator|air compressor)/', 'Automotive > Vehicle Parts & Maintenance > Air Compressors' ),
		array( '/\b(?:(car|tyre|tire|vehicle|dashboard)\\b.*\\b(clean|polish|wash|shampoo|duster|brush|restorer|wax|dresser|spot remover)|car care|car interior)/', 'Automotive > Car Accessories > Car Cleaning Products' ),
		array( '/\b(?:wiper)/', 'Automotive > Car Accessories' ),
		array( '/\b(?:car\b|tyres?\b|tires?\b|vehicle|engine|throttle|fender)/', 'Automotive > Car Accessories' ),
		array( '/\b(?:gaming chair)/', 'Musical Instruments & Entertainment > Gaming & Entertainment > Gaming Chairs' ),
		array( '/\b(?:gaming (headset|headphone))/', 'Musical Instruments & Entertainment > Gaming & Entertainment > Gaming Headsets' ),
		array( '/\b(?:mouse ?pad)/', 'Computers & Accessories > Computer Peripherals > Mouse Pads' ),
		array( '/\b(?:keyboard.*mouse|mouse.*keyboard|keyboard)/', 'Computers & Accessories > Computer Peripherals > Keyboards' ),
		array( '/\b(?:mouse)/', 'Computers & Accessories > Computer Peripherals > Mouse' ),
		array( '/\b(?:monitor(?! stand))/', 'Computers & Accessories > Computer Peripherals > Monitors' ),
		array( '/\b(?:webcam)/', 'Computers & Accessories > Computer Peripherals > Webcams' ),
		array( '/\b(?:printer)/', 'Computers & Accessories > Computer Peripherals > Printers' ),
		array( '/\b(?:pen ?drive|flash drive)/', 'Computers & Accessories > Computer Components > Pen Drives' ),
		array( '/\b(?:\\bssd\\b)/', 'Computers & Accessories > Computer Components > SSDs' ),
		array( '/\b(?:hard (disk|drive)|\\bhdd\\b)/', 'Computers & Accessories > Computer Components > External Hard Drives' ),
		array( '/\b(?:cooling pad)/', 'Computers & Accessories > Computer Components > Cooling Accessories' ),
		array( '/\b(?:router)/', 'Computers & Accessories > Networking & Power > Routers' ),
		array( '/\b(?:\\bups\\b|inverter(?! ac))/', 'Computers & Accessories > Networking & Power > UPS & Inverters' ),
		array( '/\b(?:laptop (?:bag|sleeve|case|cover))/', 'Computers & Accessories > Computer Accessories > Laptop Bags' ),
		array( '/\b(?:laptop stand)/', 'Computers & Accessories > Computer Accessories > Laptop Stands' ),
		array( '/\b(?:microphone|\\bmic\\b|\\bmike\\b)/', 'Electronics > Audio > Microphones' ),
		array( '/\b(?:school bag)/', 'Books & Stationery > Stationery > School Bags' ),
		array( '/\b(?:backpack|college bag)/', 'Bags, Luggage & Travel > Bags > Backpacks' ),
		array( '/\b(?:trolley bag|suitcase|luggage|check ?in)/', 'Bags, Luggage & Travel > Luggage > Trolley Bags' ),
		array( '/\b(?:sling bag|crossbody|messenger bag)/', 'Bags, Luggage & Travel > Bags > Sling Bags' ),
		array( '/\b(?:duffle)/', 'Bags, Luggage & Travel > Bags > Duffle Bags' ),
		array( '/\b(?:tote bag)/', 'Bags, Luggage & Travel > Bags > Tote Bags' ),
		array( '/\b(?:handbag)/', 'Fashion - Women > Accessories > Handbags' ),
		array( '/\b(?:clutch)/', 'Fashion - Women > Accessories > Clutches' ),
		array( '/\b(?:bracelet|\\bkada\\b)/', 'Jewellery & Watches > Jewellery > Bracelets' ),
		array( '/\b(?:necklace)/', 'Jewellery & Watches > Jewellery > Necklaces' ),
		array( '/\b(?:earrings?|jhumka)/', 'Jewellery & Watches > Jewellery > Earrings' ),
		array( '/\b(?:bangles?)/', 'Jewellery & Watches > Jewellery > Bangles' ),
		array( '/\b(?:pendant)/', 'Jewellery & Watches > Jewellery > Pendants' ),
		array( '/\b(?:anklet)/', 'Jewellery & Watches > Jewellery > Anklets' ),
		array( '/\b(?:mangalsutra)/', 'Jewellery & Watches > Jewellery > Mangalsutras' ),
		array( '/\b(?:(women|ladies|girls?).*\\bwatch|\\bwatch\\b.*(women|ladies))/', 'Jewellery & Watches > Watches > Women\'s Watches' ),
		array( '/\b(?:\\bwatch(es)?\\b)/', 'Jewellery & Watches > Watches > Men\'s Watches' ),
		array( '/\b(?:wallet)/', 'Fashion - Men > Accessories > Wallets' ),
		array( '/\b(?:\\bbelt\\b)/', 'Fashion - Men > Accessories > Belts' ),
		array( '/\b(?:sunglasses)/', 'Fashion - Men > Accessories > Sunglasses' ),
		array( '/\b(?:\\bcap\\b|\\bhat\\b)/', 'Fashion - Men > Accessories > Caps & Hats' ),
		array( '/\b(?:earbuds?|\\btws\\b|airdopes|\\bbuds\\b)/', 'Electronics > Audio > TWS Earbuds' ),
		array( '/\b(?:neckband|bluetooth earphone)/', 'Electronics > Audio > Bluetooth Earphones' ),
		array( '/\b(?:earphones?)/', 'Electronics > Audio > Wired Earphones' ),
		array( '/\b(?:headphones?|headset)/', 'Electronics > Audio > Headphones' ),
		array( '/\b(?:soundbar)/', 'Electronics > Audio > Soundbars' ),
		array( '/\b(?:home theat(re|er))/', 'Electronics > Audio > Home Theatre Systems' ),
		array( '/\b(?:speaker)/', 'Electronics > Audio > Bluetooth Speakers' ),
		array( '/\b(?:laptop table|bed table|adjustable height table)/', 'Home & Kitchen > Furniture > Study Tables' ),
		array( '/\b(?:gaming laptop)/', 'Computers & Accessories > Computers > Gaming Laptops' ),
		array( '/\b(?:macbook)/', 'Computers & Accessories > Computers > MacBooks' ),
		array( '/\b(?:laptop|notebook pc|chromebook)/', 'Computers & Accessories > Computers > Laptops' ),
		array( '/\b(?:desktop|all.in.one pc)/', 'Computers & Accessories > Computers > Desktop Computers' ),
		array( '/\b(?:\\bdslr\\b)/', 'Electronics > Cameras & Photography > DSLR Cameras' ),
		array( '/\b(?:action camera|gopro)/', 'Electronics > Cameras & Photography > Action Cameras' ),
		array( '/\b(?:cctv|security camera)/', 'Electronics > Cameras & Photography > CCTV Cameras' ),
		array( '/\b(?:tripod)/', 'Electronics > Cameras & Photography > Tripods' ),
		array( '/\b(?:camera)/', 'Electronics > Cameras & Photography' ),
		array( '/\b(?:projector)/', 'Electronics > Other Electronics > Projectors' ),
		array( '/\b(?:\\bdrone)/', 'Electronics > Other Electronics > Drones' ),
		array( '/\b(?:console|ps5|xbox)/', 'Electronics > Gaming > Gaming Consoles' ),
		array( '/\b(?:controller|gamepad|joystick)/', 'Electronics > Gaming > Gaming Controllers' ),
		array( '/\b(?:power ?bank)/', 'Mobiles & Tablets > Mobile Accessories > Power Banks' ),
		array( '/\b(?:charger|adapter)/', 'Mobiles & Tablets > Mobile Accessories > Chargers & Adapters' ),
		array( '/\b(?:\\bcable\\b)/', 'Mobiles & Tablets > Mobile Accessories > USB Cables' ),
		array( '/\b(?:back cover|\\bcase\\b|flip cover)/', 'Mobiles & Tablets > Mobile Accessories > Back Covers & Cases' ),
		array( '/\b(?:screen guard|tempered glass|screen protector)/', 'Mobiles & Tablets > Mobile Accessories > Screen Protectors' ),
		array( '/\b(?:memory card|sd card)/', 'Mobiles & Tablets > Mobile Accessories > Memory Cards' ),
		array( '/\b(?:selfie stick)/', 'Mobiles & Tablets > Mobile Accessories > Selfie Sticks' ),
		array( '/\b(?:(mobile|phone) (holder|stand))/', 'Mobiles & Tablets > Mobile Accessories > Mobile Holders' ),
		array( '/\b(?:\\bipad)/', 'Mobiles & Tablets > Tablets > Apple iPads' ),
		array( '/\b(?:tablet(?!s? concentrate))/', 'Mobiles & Tablets > Tablets > Android Tablets' ),
		array( '/\b(?:iphone)/', 'Mobiles & Tablets > Smartphones > Apple iPhones' ),
		array( '/\b(?:feature phone|keypad phone)/', 'Mobiles & Tablets > Feature Phones' ),
		array( '/\b(?:\\b5g\\b)/', 'Mobiles & Tablets > Smartphones > 5G Smartphones' ),
		array( '/\b(?:phone|mobile|smartphone|galaxy|redmi|realme|vivo|oppo|oneplus|poco|motorola|iqoo)/', 'Mobiles & Tablets > Smartphones > Android Phones' ),
		array( '/\b(?:deodorant|\\bdeo\\b|body spray)/', 'Fashion - Men > Accessories > Deodorants' ),
		array( '/\b(?:body mist)/', 'Beauty & Personal Care > Fragrances > Body Mists' ),
		array( '/\b(?:attar)/', 'Beauty & Personal Care > Fragrances > Attars' ),
		array( '/\b(?:(women|ladies).*perfume|perfume.*(women|ladies))/', 'Beauty & Personal Care > Fragrances > Women\'s Perfumes' ),
		array( '/\b(?:\\bmen.*perfume|perfume.*\\bmen\\b)/', 'Beauty & Personal Care > Fragrances > Men\'s Perfumes' ),
		array( '/\b(?:perfume|fragrance|eau de)/', 'Beauty & Personal Care > Fragrances > Unisex Perfumes' ),
		array( '/\b(?:face ?wash)/', 'Beauty & Personal Care > Skincare > Face Wash' ),
		array( '/\b(?:hair serum)/', 'Beauty & Personal Care > Haircare > Hair Serums' ),
		array( '/\b(?:serum)/', 'Beauty & Personal Care > Skincare > Face Serums' ),
		array( '/\b(?:moisturi[sz]er)/', 'Beauty & Personal Care > Skincare > Moisturisers' ),
		array( '/\b(?:sunscreen|spf)/', 'Beauty & Personal Care > Skincare > Sunscreens' ),
		array( '/\b(?:lip balm)/', 'Beauty & Personal Care > Skincare > Lip Balms' ),
		array( '/\b(?:lipstick)/', 'Beauty & Personal Care > Makeup > Lipsticks' ),
		array( '/\b(?:kajal)/', 'Beauty & Personal Care > Makeup > Kajal' ),
		array( '/\b(?:eyeliner)/', 'Beauty & Personal Care > Makeup > Eyeliners' ),
		array( '/\b(?:foundation)/', 'Beauty & Personal Care > Makeup > Foundations' ),
		array( '/\b(?:mascara)/', 'Beauty & Personal Care > Makeup > Mascaras' ),
		array( '/\b(?:nail polish)/', 'Beauty & Personal Care > Makeup > Nail Polish' ),
		array( '/\b(?:shampoo)/', 'Beauty & Personal Care > Haircare > Shampoos' ),
		array( '/\b(?:conditioner(?! ac))/', 'Beauty & Personal Care > Haircare > Conditioners' ),
		array( '/\b(?:hair oil)/', 'Beauty & Personal Care > Haircare > Hair Oils' ),
		array( '/\b(?:hair dryer)/', 'Beauty & Personal Care > Beauty Appliances > Hair Dryers' ),
		array( '/\b(?:straightener)/', 'Beauty & Personal Care > Beauty Appliances > Hair Straighteners' ),
		array( '/\b(?:trimmer)/', 'Beauty & Personal Care > Grooming > Trimmers' ),
		array( '/\b(?:shaver|razor)/', 'Beauty & Personal Care > Grooming > Shavers' ),
		array( '/\b(?:beard oil)/', 'Beauty & Personal Care > Grooming > Beard Oils' ),
		array( '/\b(?:body wash)/', 'Beauty & Personal Care > Bath & Body > Body Wash' ),
		array( '/\b(?:\\bsoaps?\\b)/', 'Beauty & Personal Care > Bath & Body > Soaps' ),
		array( '/\b(?:body lotion|lotion)/', 'Beauty & Personal Care > Bath & Body > Body Lotions' ),
		array( '/\b(?:\\btv\\b|television)/', 'Home Appliances > Large Appliances > Televisions' ),
		array( '/\b(?:washing machine)/', 'Home Appliances > Large Appliances > Washing Machines' ),
		array( '/\b(?:refrigerator|fridge)/', 'Home Appliances > Large Appliances > Refrigerators' ),
		array( '/\b(?:air conditioner|split ac|window ac|inverter ac)/', 'Home Appliances > Large Appliances > Air Conditioners' ),
		array( '/\b(?:air cooler|\\bcooler\\b)/', 'Home Appliances > Small Home Appliances > Air Coolers' ),
		array( '/\b(?:ceiling fan|table fan|pedestal fan|wall fan|\\bfan\\b)/', 'Home Appliances > Small Home Appliances > Fans' ),
		array( '/\b(?:geyser|water heater)/', 'Home Appliances > Small Home Appliances > Geysers' ),
		array( '/\b(?:room heater)/', 'Home Appliances > Small Home Appliances > Room Heaters' ),
		array( '/\b(?:steam iron|dry iron)/', 'Home Appliances > Small Home Appliances > Irons' ),
		array( '/\b(?:robot(ic)? (vacuum|floor cleaner))/', 'Home Appliances > Small Home Appliances > Robot Vacuums' ),
		array( '/\b(?:vacuum cleaner|vacuum)/', 'Home Appliances > Small Home Appliances > Vacuum Cleaners' ),
		array( '/\b(?:air purifier)/', 'Home Appliances > Small Home Appliances > Air Purifiers' ),
		array( '/\b(?:water purifier|\\bro\\b purifier)/', 'Home Appliances > Small Home Appliances > Water Purifiers' ),
		array( '/\b(?:sewing machine)/', 'Home Appliances > Small Home Appliances > Sewing Machines' ),
		array( '/\b(?:mixer|grinder)/', 'Home Appliances > Kitchen Appliances > Mixer Grinders' ),
		array( '/\b(?:juicer)/', 'Home Appliances > Kitchen Appliances > Juicers' ),
		array( '/\b(?:air fryer)/', 'Home Appliances > Kitchen Appliances > Air Fryers' ),
		array( '/\b(?:microwave)/', 'Home Appliances > Kitchen Appliances > Microwave Ovens' ),
		array( '/\b(?:\\botg\\b)/', 'Home Appliances > Kitchen Appliances > OTGs' ),
		array( '/\b(?:kettle)/', 'Home Appliances > Kitchen Appliances > Electric Kettles' ),
		array( '/\b(?:rice cooker)/', 'Home Appliances > Kitchen Appliances > Rice Cookers' ),
		array( '/\b(?:induction)/', 'Home Appliances > Kitchen Appliances > Induction Cooktops' ),
		array( '/\b(?:toaster)/', 'Home Appliances > Kitchen Appliances > Toasters' ),
		array( '/\b(?:coffee maker)/', 'Home Appliances > Kitchen Appliances > Coffee Makers' ),
		array( '/\b(?:sandwich maker)/', 'Home Appliances > Kitchen Appliances > Sandwich Makers' ),
		array( '/\b(?:pressure cooker)/', 'Home & Kitchen > Kitchen & Dining > Pressure Cookers' ),
		array( '/\b(?:kadai)/', 'Home & Kitchen > Kitchen & Dining > Kadai' ),
		array( '/\b(?:frying pan|tawa)/', 'Home & Kitchen > Kitchen & Dining > Frying Pans' ),
		array( '/\b(?:cookware)/', 'Home & Kitchen > Kitchen & Dining > Cookware' ),
		array( '/\b(?:knife|knives)/', 'Home & Kitchen > Kitchen & Dining > Kitchen Knives' ),
		array( '/\b(?:lunch box|tiffin)/', 'Home & Kitchen > Kitchen & Dining > Lunch Boxes' ),
		array( '/\b(?:water bottle|flask)/', 'Home & Kitchen > Kitchen & Dining > Water Bottles' ),
		array( '/\b(?:dinner set)/', 'Home & Kitchen > Kitchen & Dining > Dinner Sets' ),
		array( '/\b(?:\\bmugs?\\b|\\bcups?\\b)/', 'Home & Kitchen > Kitchen & Dining > Cups & Mugs' ),
		array( '/\b(?:container)/', 'Home & Kitchen > Kitchen & Dining > Storage Containers' ),
		array( '/\b(?:sponge|\\bmop\\b|scrubber|cleaning brush|chopper|peeler)/', 'Home & Kitchen > Kitchen & Dining > Kitchen Tools' ),
		array( '/\b(?:wall clock|\\bclock\\b)/', 'Home & Kitchen > Home Decor > Clocks' ),
		array( '/\b(?:photo frame)/', 'Home & Kitchen > Home Decor > Photo Frames' ),
		array( '/\b(?:wall art|painting)/', 'Home & Kitchen > Home Decor > Wall Art' ),
		array( '/\b(?:showpiece|idol|figurine)/', 'Home & Kitchen > Home Decor > Showpieces' ),
		array( '/\b(?:\\bvase)/', 'Home & Kitchen > Home Decor > Vases' ),
		array( '/\b(?:candle)/', 'Home & Kitchen > Home Decor > Candles' ),
		array( '/\b(?:artificial (flower|plant))/', 'Home & Kitchen > Home Decor > Artificial Flowers' ),
		array( '/\b(?:bed ?sheet)/', 'Home & Kitchen > Home Furnishing > Bedsheets' ),
		array( '/\b(?:comforter)/', 'Home & Kitchen > Home Furnishing > Comforters' ),
		array( '/\b(?:blanket)/', 'Home & Kitchen > Home Furnishing > Blankets' ),
		array( '/\b(?:\\bquilt)/', 'Home & Kitchen > Home Furnishing > Quilts' ),
		array( '/\b(?:dohar)/', 'Home & Kitchen > Home Furnishing > Dohars' ),
		array( '/\b(?:cushion cover)/', 'Home & Kitchen > Home Furnishing > Cushion Covers' ),
		array( '/\b(?:pillow)/', 'Home & Kitchen > Home Furnishing > Pillows' ),
		array( '/\b(?:curtain)/', 'Home & Kitchen > Home Furnishing > Curtains' ),
		array( '/\b(?:\\brug\\b|carpet)/', 'Home & Kitchen > Home Furnishing > Carpets' ),
		array( '/\b(?:door ?mat)/', 'Home & Kitchen > Home Furnishing > Door Mats' ),
		array( '/\b(?:towel)/', 'Home & Kitchen > Bathroom > Bath Towels' ),
		array( '/\b(?:shower|bathroom)/', 'Home & Kitchen > Bathroom > Bathroom Accessories' ),
		array( '/\b(?:shoe rack)/', 'Home & Kitchen > Home Storage & Organisation > Shoe Racks' ),
		array( '/\b(?:hanger)/', 'Home & Kitchen > Home Storage & Organisation > Hangers' ),
		array( '/\b(?:laundry basket)/', 'Home & Kitchen > Home Storage & Organisation > Laundry Baskets' ),
		array( '/\b(?:storage box|organi[sz]er)/', 'Home & Kitchen > Home Storage & Organisation > Storage Boxes' ),
		array( '/\b(?:sofa)/', 'Home & Kitchen > Furniture > Sofas' ),
		array( '/\b(?:office chair)/', 'Home & Kitchen > Furniture > Office Chairs' ),
		array( '/\b(?:study table)/', 'Home & Kitchen > Furniture > Study Tables' ),
		array( '/\b(?:mattress)/', 'Home & Kitchen > Furniture > Mattresses' ),
		array( '/\b(?:wardrobe)/', 'Home & Kitchen > Furniture > Wardrobes' ),
		array( '/\b(?:\\bchairs?\\b|\\bstool\\b)/', 'Home & Kitchen > Furniture > Chairs' ),
		array( '/\b(?:\\btables?\\b)/', 'Home & Kitchen > Furniture > Tables' ),
		array( '/\b(?:hose|rain (?:pipe|gun)|garden pipe|sprinkler|watering|irrigation)/', 'Home & Kitchen > Garden & Outdoor > Watering Equipment' ),
		array( '/\b(?:pruning|shears|garden)/', 'Home & Kitchen > Garden & Outdoor > Gardening Tools' ),
		array( '/\b(?:planter|\\bpots?\\b)/', 'Home & Kitchen > Garden & Outdoor > Planters' ),
		array( '/\b(?:diaper)/', 'Kids, Baby & Toys > Baby & Infant > Diapers' ),
		array( '/\b(?:baby wipes)/', 'Kids, Baby & Toys > Baby & Infant > Baby Wipes' ),
		array( '/\b(?:feeding bottle)/', 'Kids, Baby & Toys > Baby & Infant > Feeding Bottles' ),
		array( '/\b(?:stroller|pram)/', 'Kids, Baby & Toys > Baby & Infant > Strollers' ),
		array( '/\b(?:soft toy|teddy)/', 'Kids, Baby & Toys > Toys & Games > Soft Toys' ),
		array( '/\b(?:building blocks?|lego)/', 'Kids, Baby & Toys > Toys & Games > Building Blocks' ),
		array( '/\b(?:puzzle)/', 'Kids, Baby & Toys > Toys & Games > Puzzles' ),
		array( '/\b(?:board game)/', 'Kids, Baby & Toys > Toys & Games > Board Games' ),
		array( '/\b(?:\\bdolls?\\b)/', 'Kids, Baby & Toys > Toys & Games > Dolls' ),
		array( '/\b(?:remote control|\\brc\\b)/', 'Kids, Baby & Toys > Toys & Games > Remote Control Toys' ),
		array( '/\b(?:\\btoys?\\b)/', 'Kids, Baby & Toys > Toys & Games' ),
		array( '/\b(?:(kids|boys|girls).*(shoes?|sandals?|sneakers?))/', 'Kids, Baby & Toys > Kids Footwear & Accessories' ),
		array( '/\b(?:\\bboys?\\b)/', 'Kids, Baby & Toys > Boys Clothing' ),
		array( '/\b(?:\\bgirls?\\b|frock)/', 'Kids, Baby & Toys > Girls Clothing' ),
		array( '/\b(?:\\bkids?\\b)/', 'Kids, Baby & Toys' ),
		array( '/\b(?:(women|ladies|womens).*(heels?)|\\bheels\\b)/', 'Fashion - Women > Footwear > Heels' ),
		array( '/\b(?:(women|ladies|womens).*\\bflats?\\b)/', 'Fashion - Women > Footwear > Flats' ),
		array( '/\b(?:(women|ladies|womens).*(sandals?))/', 'Fashion - Women > Footwear > Sandals' ),
		array( '/\b(?:(women|ladies|womens).*(sneakers?))/', 'Fashion - Women > Footwear > Sneakers' ),
		array( '/\b(?:(women|ladies|womens).*(sports shoes|running shoes))/', 'Fashion - Women > Footwear > Sports Shoes' ),
		array( '/\b(?:(women|ladies|womens).*(slippers?|flip flops?))/', 'Fashion - Women > Footwear > Slippers' ),
		array( '/\b(?:(women|ladies|womens).*(shoes?|boots?))/', 'Fashion - Women > Footwear > Casual Shoes' ),
		array( '/\b(?:saree|sari\\b)/', 'Fashion - Women > Ethnic Wear > Sarees' ),
		array( '/\b(?:kurti)/', 'Fashion - Women > Ethnic Wear > Kurtis' ),
		array( '/\b(?:lehenga)/', 'Fashion - Women > Ethnic Wear > Lehenga Choli' ),
		array( '/\b(?:salwar)/', 'Fashion - Women > Ethnic Wear > Salwar Suits' ),
		array( '/\b(?:dupatta.*(set|kurta)|(kurta|kurta pant|kurta palazzo).*(set|dupatta))/', 'Fashion - Women > Ethnic Wear > Kurta Sets' ),
		array( '/\b(?:(women|ladies|womens).*kurta)/', 'Fashion - Women > Ethnic Wear > Kurtas' ),
		array( '/\b(?:palazzo)/', 'Fashion - Women > Ethnic Wear > Palazzos' ),
		array( '/\b(?:leggings?)/', 'Fashion - Women > Ethnic Wear > Leggings' ),
		array( '/\b(?:\\bbra\\b|lingerie|panties|nightie)/', 'Fashion - Women > Innerwear & Sleepwear' ),
		array( '/\b(?:(women|ladies|womens).*(dress|gown)|\\bdress\\b)/', 'Fashion - Women > Western Wear > Dresses' ),
		array( '/\b(?:(women|ladies|womens).*\\btops?\\b)/', 'Fashion - Women > Western Wear > Tops' ),
		array( '/\b(?:(women|ladies|womens).*jeans)/', 'Fashion - Women > Western Wear > Jeans' ),
		array( '/\b(?:(women|ladies|womens).*(t ?shirt|tee))/', 'Fashion - Women > Western Wear > T-Shirts' ),
		array( '/\b(?:skirt)/', 'Fashion - Women > Western Wear > Skirts' ),
		array( '/\b(?:jumpsuit)/', 'Fashion - Women > Western Wear > Jumpsuits' ),
		array( '/\b(?:(women|ladies|womens))/', 'Fashion - Women' ),
		array( '/\b(?:sneakers?)/', 'Fashion - Men > Footwear > Sneakers' ),
		array( '/\b(?:sports shoes|running shoes)/', 'Fashion - Men > Footwear > Sports Shoes' ),
		array( '/\b(?:formal shoes)/', 'Fashion - Men > Footwear > Formal Shoes' ),
		array( '/\b(?:loafers?)/', 'Fashion - Men > Footwear > Loafers' ),
		array( '/\b(?:boots?)/', 'Fashion - Men > Footwear > Boots' ),
		array( '/\b(?:sandals?|clogs?)/', 'Fashion - Men > Footwear > Sandals' ),
		array( '/\b(?:flip flops?)/', 'Fashion - Men > Footwear > Flip-Flops' ),
		array( '/\b(?:slippers?)/', 'Fashion - Men > Footwear > Slippers' ),
		array( '/\b(?:\\bsocks\\b)/', 'Fashion - Men > Footwear > Socks' ),
		array( '/\b(?:shoes?|footwear)/', 'Fashion - Men > Footwear > Casual Shoes' ),
		array( '/\b(?:polo)/', 'Fashion - Men > Clothing > Polo T-Shirts' ),
		array( '/\b(?:t ?shirt|tee\\b)/', 'Fashion - Men > Clothing > T-Shirts' ),
		array( '/\b(?:formal shirt)/', 'Fashion - Men > Clothing > Formal Shirts' ),
		array( '/\b(?:\\bshirt)/', 'Fashion - Men > Clothing > Casual Shirts' ),
		array( '/\b(?:jeans)/', 'Fashion - Men > Clothing > Jeans' ),
		array( '/\b(?:shorts)/', 'Fashion - Men > Clothing > Shorts' ),
		array( '/\b(?:cargos?|chinos?|trousers?)/', 'Fashion - Men > Clothing > Casual Trousers' ),
		array( '/\b(?:track ?pants?)/', 'Fashion - Men > Clothing > Track Pants' ),
		array( '/\b(?:joggers?)/', 'Fashion - Men > Clothing > Joggers' ),
		array( '/\b(?:hoodie)/', 'Fashion - Men > Clothing > Hoodies' ),
		array( '/\b(?:sweatshirt)/', 'Fashion - Men > Clothing > Sweatshirts' ),
		array( '/\b(?:sweater)/', 'Fashion - Men > Clothing > Sweaters' ),
		array( '/\b(?:blazer)/', 'Fashion - Men > Clothing > Blazers' ),
		array( '/\b(?:jacket)/', 'Fashion - Men > Clothing > Jackets' ),
		array( '/\b(?:kurta)/', 'Fashion - Men > Ethnic Wear > Kurtas' ),
		array( '/\b(?:briefs?|trunks?|boxers?|\\bvests?\\b)/', 'Fashion - Men > Innerwear & Sleepwear' ),
		array( '/\b(?:\\bmen\\b|\\bmens\\b)/', 'Fashion - Men' ),
		array( '/\b(?:ankle support|knee support|knee cap|back support)/', 'Health & Wellness > Personal Care & Recovery > Fitness Recovery Products' ),
		array( '/\b(?:massager)/', 'Health & Wellness > Personal Care & Recovery > Massagers' ),
		array( '/\b(?:thermometer)/', 'Health & Wellness > Health Monitoring > Digital Thermometers' ),
		array( '/\b(?:blood pressure|bp monitor)/', 'Health & Wellness > Health Monitoring > Blood Pressure Monitors' ),
		array( '/\b(?:weighing scale)/', 'Health & Wellness > Health Monitoring > Weighing Scales' ),
		array( '/\b(?:oximeter)/', 'Health & Wellness > Health Monitoring > Pulse Oximeters' ),
		array( '/\b(?:protein|whey|creatine)/', 'Health & Wellness > Wellness Accessories > Fitness Nutrition' ),
		array( '/\b(?:supplement|vitamin|multivitamin|capsules?|capusle|berberine|omega|magnesium|zinc|glycinate|isabgol|psyllium|fiber)/', 'Health & Wellness > Wellness Accessories > Vitamins & Supplements' ),
		array( '/\b(?:boxing|punching bag)/', 'Sports & Fitness > Fitness Equipment > Gym Equipment' ),
		array( '/\b(?:dumbbell)/', 'Sports & Fitness > Fitness Equipment > Dumbbells' ),
		array( '/\b(?:yoga mat)/', 'Sports & Fitness > Fitness Equipment > Yoga Mats' ),
		array( '/\b(?:treadmill)/', 'Sports & Fitness > Fitness Equipment > Treadmills' ),
		array( '/\b(?:exercise bike|exerciser|peddler)/', 'Sports & Fitness > Fitness Equipment > Exercise Bikes' ),
		array( '/\b(?:resistance band)/', 'Sports & Fitness > Fitness Equipment > Resistance Bands' ),
		array( '/\b(?:\\bgym\\b|ankle weights?|workout|shaker)/', 'Sports & Fitness > Fitness Equipment > Home Gym Equipment' ),
		array( '/\b(?:\\bcycle\\b|bicycle)/', 'Sports & Fitness > Outdoor & Activewear > Cycling Accessories' ),
		array( '/\b(?:cricket)/', 'Sports & Fitness > Sports Equipment > Cricket Equipment' ),
		array( '/\b(?:badminton)/', 'Sports & Fitness > Sports Equipment > Badminton Equipment' ),
		array( '/\b(?:football)/', 'Sports & Fitness > Sports Equipment > Football Equipment' ),
		array( '/\b(?:tent|camping)/', 'Sports & Fitness > Outdoor & Activewear > Camping Equipment' ),
		array( '/\b(?:calculator)/', 'Books & Stationery > Stationery > Calculators' ),
		array( '/\b(?:\\bpens?\\b)/', 'Books & Stationery > Stationery > Pens' ),
		array( '/\b(?:pencil|crayon|sketch pen|colou?rs? set)/', 'Books & Stationery > Stationery > Art Supplies' ),
		array( '/\b(?:notebook|diary)/', 'Books & Stationery > Stationery > Notebooks' ),
		array( '/\b(?:\\bfile\\b|folder)/', 'Books & Stationery > Stationery > Files & Folders' ),
		array( '/\b(?:exam|competitive|upsc|appsc|tspsc|\\bssc\\b|\\bneet\\b|\\bjee\\b|previous papers)/', 'Books & Stationery > Books > Competitive Exam Books' ),
		array( '/\b(?:novel)/', 'Books & Stationery > Books > Fiction' ),
		array( '/\b(?:\\bbooks?\\b|edition|paperback|hardcover)/', 'Books & Stationery > Books' ),
		array( '/\b(?:\\brice\\b)/', 'Grocery & Gourmet > Staples > Rice & Rice Products' ),
		array( '/\b(?:\\batta\\b|flour)/', 'Grocery & Gourmet > Staples > Atta & Flour' ),
		array( '/\b(?:\\bdal\\b|pulses)/', 'Grocery & Gourmet > Staples > Pulses & Dals' ),
		array( '/\b(?:cooking oil|edible oil|sunflower oil|mustard oil|groundnut oil)/', 'Grocery & Gourmet > Staples > Edible Oils' ),
		array( '/\b(?:masala|spices?)/', 'Grocery & Gourmet > Staples > Spices & Masalas' ),
		array( '/\b(?:dry fruits?|almonds?|cashews?|walnuts?|raisins?|pistachio)/', 'Grocery & Gourmet > Food & Snacks > Dry Fruits & Nuts' ),
		array( '/\b(?:chips|namkeen|snacks?)/', 'Grocery & Gourmet > Food & Snacks > Snacks' ),
		array( '/\b(?:biscuits?|cookies?)/', 'Grocery & Gourmet > Food & Snacks > Biscuits & Cookies' ),
		array( '/\b(?:chocolates?)/', 'Grocery & Gourmet > Food & Snacks > Chocolates' ),
		array( '/\b(?:juice)/', 'Grocery & Gourmet > Beverages > Juices & Beverages' ),
		array( '/\b(?:\\btea\\b)/', 'Grocery & Gourmet > Beverages > Tea' ),
		array( '/\b(?:coffee)/', 'Grocery & Gourmet > Beverages > Coffee' ),
		array( '/\b(?:\\bdogs?\\b|puppy)/', 'Pet Supplies > Dog Supplies' ),
		array( '/\b(?:cat food|cat litter|\\bcats?\\b|kitten)/', 'Pet Supplies > Cat Supplies' ),
		array( '/\b(?:aquarium|fish tank)/', 'Pet Supplies > Other Pet Supplies > Aquarium Supplies' ),
		array( '/\b(?:capo|guitar strings|music stand)/', 'Musical Instruments & Entertainment > Musical Instruments > Musical Accessories' ),
		array( '/\b(?:guitar|ukulele)/', 'Musical Instruments & Entertainment > Musical Instruments > Guitars' ),
		array( '/\b(?:\\bdrums?\\b)/', 'Musical Instruments & Entertainment > Musical Instruments > Drums' ),
		array( '/\b(?:piano)/', 'Musical Instruments & Entertainment > Musical Instruments > Pianos' ),
		array( '/\b(?:karaoke)/', 'Musical Instruments & Entertainment > Musical Instruments > Karaoke Systems' ),
		array( '/\b(?:gift hamper|hamper)/', 'Gifts & Special Occasions > Gift Types > Gift Hampers' ),
		array( '/\b(?:personali[sz]ed)/', 'Gifts & Special Occasions > Gift Types > Personalised Gifts' ),
		array( '/\b(?:pooja|puja)/', 'Gifts & Special Occasions > Gift Types > Pooja & Religious Gifts' ),
		array( '/\b(?:drill|power tool)/', 'Office & Industrial > Tools & Supplies > Power Tools' ),
		array( '/\b(?:screwdriver|spanner|wrench|hand tool)/', 'Office & Industrial > Tools & Supplies > Hand Tools' ),
		array( '/\b(?:umbrella|neck pillow)/', 'Bags, Luggage & Travel > Travel Accessories > Travel Comfort Accessories' ),
		array( '/\b(?:toilet brush|cleaning brush|foam cleaner|bristle brush)/', 'Home & Kitchen > Bathroom > Bathroom Accessories' ),
		array( '/\b(?:rucksack)/', 'Bags, Luggage & Travel > Bags > Backpacks' ),
		array( '/\b(?:bean bag)/', 'Home & Kitchen > Furniture > Chairs' ),
		array( '/\b(?:dressing trolley|kitchen trolley)/', 'Home & Kitchen > Home Storage & Organisation > Shelves' ),
		array( '/\b(?:\\d+ ?gb\\b)/', 'Mobiles & Tablets > Smartphones > Android Phones' ),
	);
	foreach ( $rules as $r ) {
		if ( preg_match( $r[0], $t ) ) {
			return array_map( 'trim', explode( '>', $r[1] ) );
		}
	}
	return array();
}

/** Category path names (main, sub, child) → deepest term id, creating missing levels with the Adyzio list's slugs. */
function adyzio_term_for_path( $names ) {
	$names = array_values( array_filter( array_map( 'trim', (array) $names ), 'strlen' ) );
	if ( ! $names ) {
		return 0;
	}
	static $slug_by_path = null;
	if ( null === $slug_by_path ) {
		$slug_by_path = array();
		$by           = array();
		foreach ( adyzio_category_list() as $c ) {
			$by[ $c[1] ] = $c;
		}
		foreach ( adyzio_category_list() as $c ) {
			$p = array( $c[0] );
			$s = $c[2];
			while ( $s && isset( $by[ $s ] ) ) {
				array_unshift( $p, $by[ $s ][0] );
				$s = $by[ $s ][2];
			}
			$slug_by_path[ strtolower( implode( '>', $p ) ) ] = $c[1];
		}
	}
	$parent = 0;
	$walked = array();
	foreach ( $names as $name ) {
		$walked[] = $name;
		$slug     = $slug_by_path[ strtolower( implode( '>', $walked ) ) ] ?? '';
		$term     = $slug ? get_term_by( 'slug', $slug, 'category' ) : false;
		if ( ! $term || (int) $term->parent !== $parent ) {
			$found = get_terms( array( 'taxonomy' => 'category', 'name' => $name, 'parent' => $parent, 'hide_empty' => false, 'number' => 1 ) );
			$term  = ( ! is_wp_error( $found ) && $found ) ? $found[0] : false;
		}
		if ( ! $term ) {
			$args = array( 'parent' => $parent );
			if ( $slug ) {
				$args['slug'] = $slug;
			}
			$new = wp_insert_term( $name, 'category', $args );
			if ( is_wp_error( $new ) ) {
				$tid = (int) $new->get_error_data( 'term_exists' );
				if ( ! $tid ) {
					return $parent;
				}
				$parent = $tid;
				continue;
			}
			$parent = (int) $new['term_id'];
			continue;
		}
		$parent = (int) $term->term_id;
	}
	return $parent;
}

/** One sheet row (header => value) → cleaned deal fields. */
function adyzio_import_map_row( $d ) {
	$title = trim( (string) ( $d['title'] ?? '' ) );
	$plink = esc_url_raw( trim( (string) ( $d['product_link'] ?? '' ) ) );
	$from_link = false;
	if ( '' === $title || in_array( strtolower( $title ), array( 'image', 'img', 'product', 'n/a', 'na', '-' ), true ) ) {
		$title     = $plink ? adyzio_title_from_link( $plink ) : '';
		$from_link = true;
	}
	$brand = sanitize_text_field( $d['brand'] ?? '' );
	if ( $brand && $title && false === stripos( $title, $brand ) ) {
		$title = $brand . ' ' . $title;
	}
	$img   = trim( (string) ( $d['drive_image'] ?? '' ) );
	$img   = $img ? adyzio_drive_image( $img ) : trim( (string) ( $d['image_url'] ?? '' ) );
	$num   = function ( $v ) {
		$v = str_replace( array( ',', '₹', 'Rs.', 'Rs', ' ' ), '', (string) $v );
		return is_numeric( $v ) ? (string) (int) round( (float) $v ) : '';
	};
	return array(
		'title'        => sanitize_text_field( $title ),
		'title_guess'  => $from_link,
		'store'        => sanitize_text_field( $d['store'] ?? '' ),
		'brand'        => $brand,
		'buy_link'     => esc_url_raw( trim( (string) ( $d['buy_link'] ?? '' ) ) ),
		'product_link' => $plink,
		'image_url'    => esc_url_raw( $img ),
		'price'        => $num( $d['price'] ?? '' ),
		'mrp'          => $num( $d['mrp'] ?? '' ),
		'scraped_at'   => adyzio_parse_scraped_at( $d['scraped_at'] ?? '' ),
		'category'     => sanitize_text_field( $d['category'] ?? '' ),
		'subcategory'  => sanitize_text_field( $d['subcategory'] ?? '' ),
		'child'        => sanitize_text_field( $d['child'] ?? '' ),
		'cat_path'     => sanitize_text_field( $d['cat_path'] ?? '' ),
		'deal_type'    => sanitize_key( $d['deal_type'] ?? '' ),
		'good_for'     => sanitize_text_field( $d['good_for'] ?? '' ),
		'check_list'   => sanitize_textarea_field( str_replace( '|', "\n", (string) ( $d['check_list'] ?? '' ) ) ),
		'description'  => wp_kses_post( $d['description'] ?? '' ),
		'ends'         => trim( (string) ( $d['ends'] ?? '' ) ),
	);
}

/** Find a category by name or slug; create it (under $parent_id) if missing. */
function adyzio_import_category( $name, $parent_id = 0 ) {
	$name = trim( (string) $name );
	if ( '' === $name ) {
		return 0;
	}
	$slug = sanitize_title( $name );
	$term = get_term_by( 'slug', $slug, 'category' );
	if ( ! $term ) {
		$term = get_term_by( 'name', $name, 'category' );
	}
	if ( $term ) {
		return (int) $term->term_id;
	}
	$new = wp_insert_term( $name, 'category', array( 'slug' => $slug, 'parent' => (int) $parent_id ) );
	return is_wp_error( $new ) ? 0 : (int) $new['term_id'];
}

/* ================= import engine (shared by file upload and Google Sheet sync) ================= */

/** Stable id for a product, so the same product is never posted twice. */
function adyzio_product_key( $url ) {
	$url = trim( (string) $url );
	if ( '' === $url ) {
		return '';
	}
	$p    = wp_parse_url( $url );
	$host = strtolower( preg_replace( '/^(www\.|m\.|dl\.)/', '', $p['host'] ?? '' ) );
	$path = strtolower( rtrim( $p['path'] ?? '', '/' ) );
	if ( '' === $host ) {
		return '';
	}
	if ( false !== strpos( $host, 'amazon.' ) && preg_match( '#/(?:dp|gp/product|gp/aw/d)/([a-z0-9]{10})#', $path, $m ) ) {
		return 'amazon:' . $m[1];
	}
	if ( false !== strpos( $host, 'flipkart.com' ) && preg_match( '#/p/(itm[a-z0-9]+)#', $path, $m ) ) {
		parse_str( $p['query'] ?? '', $q );
		$pid = isset( $q['pid'] ) ? strtolower( preg_replace( '/[^A-Za-z0-9]/', '', $q['pid'] ) ) : '';
		/* same item with a different colour/size has its own slug, so keep the slug too */
		return 'flipkart:' . $m[1] . ':' . ( $pid ?: md5( $path ) );
	}
	return $host . $path;
}

/** Normalise an affiliate link for matching (drop tracking noise like trailing slashes and spaces). */
function adyzio_link_norm( $url ) {
	return strtolower( rtrim( trim( (string) $url ), '/' ) );
}

/** Map of every existing deal: "k:<product key>" and "b:<affiliate link>" → post id. */
function adyzio_key_map() {
	global $wpdb;
	$rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		"SELECT pm.post_id, pm.meta_key, pm.meta_value FROM {$wpdb->postmeta} pm
		 JOIN {$wpdb->posts} p ON p.ID = pm.post_id
		 WHERE pm.meta_key IN ('adz_key','product_link','buy_link') AND p.post_type = 'post' AND p.post_status NOT IN ('trash','auto-draft','inherit')
		 ORDER BY p.post_status = 'publish' DESC, p.ID ASC"
	);
	$map = array();
	foreach ( (array) $rows as $r ) {
		if ( 'buy_link' === $r->meta_key ) {
			$k = 'b:' . adyzio_link_norm( $r->meta_value );
		} else {
			$k = 'k:' . ( 'adz_key' === $r->meta_key ? $r->meta_value : adyzio_product_key( $r->meta_value ) );
		}
		if ( strlen( $k ) > 2 && ! isset( $map[ $k ] ) ) {
			$map[ $k ] = (int) $r->post_id;
		}
	}
	return $map;
}

/** Turn file/sheet rows into deal items. Returns array( 'items' => [...], 'error' => '' ). */
function adyzio_import_prepare( $rows ) {
	if ( count( $rows ) < 2 ) {
		return array( 'items' => array(), 'error' => 'The file has no product rows.' );
	}
	$aliases = adyzio_import_aliases();
	$fields  = array();
	foreach ( $rows[0] as $i => $h ) {
		$n = preg_replace( '/(inr|rs)$/', '', adyzio_import_norm_header( $h ) );
		if ( isset( $aliases[ $n ] ) && ! in_array( $aliases[ $n ], $fields, true ) ) {
			$fields[ $i ] = $aliases[ $n ];
		}
	}
	if ( ! in_array( 'title', $fields, true ) && ! in_array( 'product_link', $fields, true ) && ! in_array( 'buy_link', $fields, true ) ) {
		return array( 'items' => array(), 'error' => 'Could not find a "Product Title", "Product Link" or "Affiliate Link" column in the first row.' );
	}
	$items = array();
	foreach ( array_slice( $rows, 1 ) as $n => $row ) {
		if ( count( array_filter( array_map( 'strval', $row ), 'strlen' ) ) === 0 ) {
			continue;
		}
		$raw = array();
		foreach ( $fields as $i => $f ) {
			$raw[ $f ] = $row[ $i ] ?? '';
		}
		$d         = adyzio_import_map_row( $raw );
		$d['line'] = $n + 2;
		$items[]   = $d;
	}
	return array( 'items' => $items, 'error' => '' );
}

/**
 * Create or update one deal.
 * $o: publish (bool), prices_ok (bool), use_images (bool), cat_mode ('auto' or term id).
 * Returns array( result => added|updated|unchanged|skipped, id, status, note ).
 */
function adyzio_import_apply( $d, $o, &$map ) {
	if ( '' === $d['title'] || 0 === stripos( $d['title'], 'Example product name' ) ) {
		return array( 'result' => 'skipped', 'note' => "Row {$d['line']}: no product title and no usable product link." );
	}
	$key = adyzio_product_key( $d['product_link'] );
	if ( '' === $key && $d['buy_link'] ) {
		$key = 'aff:' . adyzio_link_norm( $d['buy_link'] );
	}
	if ( '' === $key ) {
		$key = 't:' . sanitize_title( $d['store'] . ' ' . $d['title'] );
	}
	$id = $map[ 'k:' . $key ] ?? 0;
	if ( ! $id && $d['buy_link'] ) {
		$id = $map[ 'b:' . adyzio_link_norm( $d['buy_link'] ) ] ?? 0;
	}

	$meta = array(
		'buy_link'     => $d['buy_link'],
		'product_link' => $d['product_link'],
		'store'        => $d['store'],
		'brand'        => $d['brand'],
		'image_url'    => $o['use_images'] ? $d['image_url'] : '',
		'good_for'     => $d['good_for'],
		'check_list'   => $d['check_list'],
		'price'        => $d['price'],
		'mrp'          => ( $d['mrp'] && $d['price'] && (int) $d['mrp'] >= (int) $d['price'] ) ? $d['mrp'] : '',
		'deal_type'    => in_array( $d['deal_type'], array( 'loot', 'today', 'drop' ), true ) ? $d['deal_type'] : '',
	);
	if ( $o['prices_ok'] && '' !== $d['price'] ) {
		$meta['price_checked'] = $d['scraped_at'] ?: time();
	}
	if ( $d['ends'] ) {
		$dt = date_create_immutable( $d['ends'], wp_timezone() );
		if ( $dt ) {
			$meta['deal_ends'] = $dt->getTimestamp();
		}
	}

	/* ---------- update an existing post ---------- */
	if ( $id && get_post( $id ) ) {
		$post    = get_post( $id );
		$changed = false;
		foreach ( $meta as $k => $v ) {
			if ( '' === $v || null === $v ) {
				continue; /* an empty cell never wipes what's already saved */
			}
			if ( 'price_checked' === $k && (int) get_post_meta( $id, $k, true ) >= (int) $v ) {
				continue;
			}
			if ( (string) get_post_meta( $id, $k, true ) !== (string) $v ) {
				update_post_meta( $id, $k, $v );
				$changed = true;
			}
		}
		if ( get_post_meta( $id, 'adz_key', true ) !== $key ) {
			update_post_meta( $id, 'adz_key', $key );
		}
		$upd = array();
		if ( get_post_meta( $id, '_adz_title_auto', true ) && ! $d['title_guess'] && $d['title'] !== $post->post_title ) {
			$upd['post_title'] = $d['title'];
			delete_post_meta( $id, '_adz_title_auto' );
		}
		$has_link = $d['buy_link'] || get_post_meta( $id, 'buy_link', true );
		if ( $o['publish'] && $has_link && in_array( $post->post_status, array( 'draft', 'pending' ), true ) ) {
			$upd['post_status'] = 'publish';
		}
		if ( $upd ) {
			$upd['ID'] = $id;
			wp_update_post( $upd );
			$changed = true;
		}
		if ( $changed && function_exists( 'adyzio_seo_apply' ) ) {
			adyzio_seo_apply( $id ); /* only fields Adyzio filled before, or empty ones */
		}
		$map[ 'k:' . $key ] = $id;
		$status = $upd['post_status'] ?? $post->post_status;
		return array( 'result' => $changed ? 'updated' : 'unchanged', 'id' => $id, 'status' => $status, 'nolink' => ! $has_link );
	}

	/* ---------- create a new post ---------- */
	$cats = array();
	if ( 'auto' !== $o['cat_mode'] && (int) $o['cat_mode'] ) {
		$cats = array( (int) $o['cat_mode'] );
	} else {
		$path = array_filter( array( $d['category'], $d['subcategory'], $d['child'] ), 'strlen' );
		if ( ! $path && $d['cat_path'] ) {
			$path = explode( '>', $d['cat_path'] );
		}
		if ( ! $path ) {
			$path = adyzio_guess_category( $d['title'] . ' ' . str_replace( '-', ' ', (string) wp_parse_url( $d['product_link'], PHP_URL_PATH ) ) );
		}
		$tid  = $path ? adyzio_term_for_path( $path ) : 0;
		$cats = array( $tid ?: ( (int) get_option( 'default_category' ) ?: adyzio_import_category( "Today's Deals" ) ) );
	}
	$status = ( $o['publish'] && $d['buy_link'] ) ? 'publish' : 'draft';
	$id     = wp_insert_post( array(
		'post_title'    => $d['title'],
		'post_status'   => $status,
		'post_type'     => 'post',
		'post_excerpt'  => $d['good_for'],
		'post_content'  => $d['description'] ? "<!-- wp:paragraph -->\n<p>" . $d['description'] . "</p>\n<!-- /wp:paragraph -->" : '',
		'post_category' => $cats,
	), true );
	if ( is_wp_error( $id ) ) {
		return array( 'result' => 'skipped', 'note' => "Row {$d['line']} failed: " . $id->get_error_message() );
	}
	$meta['adz_key'] = $key;
	foreach ( $meta as $k => $v ) {
		if ( '' !== $v && null !== $v ) {
			update_post_meta( $id, $k, $v );
		}
	}
	if ( $d['title_guess'] ) {
		update_post_meta( $id, '_adz_title_auto', 1 );
	}
	/* SEO: short URL from the product name, a one-line intro when the row has no description, and Rank Math fields */
	if ( function_exists( 'adyzio_seo_apply' ) ) {
		$short = sanitize_title( adyzio_seo_keyword( $d['title'] ) );
		if ( $short ) {
			wp_update_post( array( 'ID' => $id, 'post_name' => wp_unique_post_slug( $short, $id, $status, 'post', 0 ) ) );
		}
		adyzio_seo_intro( $id );
		adyzio_seo_apply( $id );
	}
	$map[ 'k:' . $key ] = $id;
	if ( $d['buy_link'] ) {
		$map[ 'b:' . adyzio_link_norm( $d['buy_link'] ) ] = $id;
	}
	return array( 'result' => 'added', 'id' => $id, 'status' => $status, 'nolink' => ! $d['buy_link'], 'guess' => $d['title_guess'] );
}

/** Empty stats block. */
function adyzio_import_stats() {
	return array( 'added' => 0, 'updated' => 0, 'unchanged' => 0, 'skipped' => 0, 'published' => 0, 'nolink' => 0, 'guessed' => 0 );
}

/** Add one apply() result into the stats and notes. */
function adyzio_import_count( &$stats, &$notes, $res, $d ) {
	$stats[ $res['result'] ]++;
	if ( ! empty( $res['note'] ) ) {
		$notes[] = $res['note'];
	}
	if ( in_array( $res['result'], array( 'added', 'updated' ), true ) && 'publish' === ( $res['status'] ?? '' ) ) {
		$stats['published']++;
	}
	if ( ! empty( $res['nolink'] ) && 'skipped' !== $res['result'] ) {
		$stats['nolink']++;
	}
	if ( ! empty( $res['guess'] ) ) {
		$stats['guessed']++;
	}
}

/** Clear the page cache once after changes, so visitors see new deals. */
function adyzio_purge_cache() {
	do_action( 'litespeed_purge_all' );
	if ( function_exists( 'wp_cache_flush' ) ) {
		wp_cache_flush();
	}
}

/* ================= one import at a time (site-wide lock) ================= */

/** Take the import lock. add_option() fails if the row already exists, so only one request can win. */
function adyzio_lock_acquire() {
	if ( add_option( 'adyzio_import_lock', time(), '', false ) ) {
		return true;
	}
	$since = (int) get_option( 'adyzio_import_lock' );
	if ( $since && time() - $since > 180 ) { /* a crashed run left it behind */
		delete_option( 'adyzio_import_lock' );
		return add_option( 'adyzio_import_lock', time(), '', false );
	}
	return false;
}
function adyzio_lock_release() {
	delete_option( 'adyzio_import_lock' );
}

/* ================= batched jobs with progress ================= */

function adyzio_job_get( $id ) {
	$j = get_option( 'adyzio_job_' . preg_replace( '/[^a-z0-9]/', '', (string) $id ) );
	return is_array( $j ) ? $j : null;
}
function adyzio_job_save( $j ) {
	update_option( 'adyzio_job_' . $j['id'], $j, false );
}
function adyzio_job_create( $items, $o, $source ) {
	$j = array(
		'id'      => strtolower( wp_generate_password( 12, false ) ),
		'items'   => $items,
		'opts'    => $o,
		'pos'     => 0,
		'stats'   => adyzio_import_stats(),
		'notes'   => array(),
		'source'  => $source,
		'started' => time(),
	);
	adyzio_job_save( $j );
	return $j;
}

/** Options from the upload form. */
function adyzio_import_opts_from_post() {
	// phpcs:disable WordPress.Security.NonceVerification -- checked by the caller
	return array(
		'publish'    => isset( $_POST['status'] ) && 'publish' === $_POST['status'] && current_user_can( 'publish_posts' ),
		'prices_ok'  => ! empty( $_POST['checked_today'] ),
		'use_images' => ! empty( $_POST['use_images'] ),
		'cat_mode'   => isset( $_POST['cat_mode'] ) ? sanitize_text_field( wp_unslash( $_POST['cat_mode'] ) ) : 'auto',
	);
	// phpcs:enable
}

function adyzio_ajax_fail( $msg ) {
	wp_send_json( array( 'error' => $msg ) );
}

/* Step 1 (file): read the upload and create a job. */
add_action( 'wp_ajax_adyzio_import_start', function () {
	if ( ! current_user_can( 'edit_posts' ) || ! check_ajax_referer( 'adyzio_import', 'nonce', false ) ) {
		adyzio_ajax_fail( 'Not allowed. Reload the page and try again.' );
	}
	if ( empty( $_FILES['adyzio_csv']['tmp_name'] ) || ! is_uploaded_file( $_FILES['adyzio_csv']['tmp_name'] ) ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		adyzio_ajax_fail( 'No file uploaded.' );
	}
	$tmp  = $_FILES['adyzio_csv']['tmp_name']; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	$name = strtolower( (string) ( $_FILES['adyzio_csv']['name'] ?? '' ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	$is_x = '.xlsx' === substr( $name, -5 ) || 'PK' === file_get_contents( $tmp, false, null, 0, 2 ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	$rows = $is_x ? adyzio_read_xlsx( $tmp ) : adyzio_read_csv( $tmp );
	if ( is_wp_error( $rows ) ) {
		adyzio_ajax_fail( $rows->get_error_message() );
	}
	$prep = adyzio_import_prepare( $rows );
	if ( $prep['error'] ) {
		adyzio_ajax_fail( $prep['error'] );
	}
	$j = adyzio_job_create( $prep['items'], adyzio_import_opts_from_post(), 'file' );
	wp_send_json( array( 'job' => $j['id'], 'total' => count( $j['items'] ) ) );
} );

/* Step 1 (sheet): fetch the Google Sheet now and create a job. */
add_action( 'wp_ajax_adyzio_sync_start', function () {
	if ( ! current_user_can( 'manage_options' ) || ! check_ajax_referer( 'adyzio_import', 'nonce', false ) ) {
		adyzio_ajax_fail( 'Not allowed. Reload the page and try again.' );
	}
	$rows = adyzio_sheet_fetch();
	if ( is_wp_error( $rows ) ) {
		adyzio_ajax_fail( $rows->get_error_message() );
	}
	$prep = adyzio_import_prepare( $rows );
	if ( $prep['error'] ) {
		adyzio_ajax_fail( $prep['error'] );
	}
	$j = adyzio_job_create( $prep['items'], adyzio_sync_opts(), 'sheet' );
	wp_send_json( array( 'job' => $j['id'], 'total' => count( $j['items'] ) ) );
} );

/* Step 2: process the next batch. The browser calls this until done. */
add_action( 'wp_ajax_adyzio_import_step', function () {
	if ( ! current_user_can( 'edit_posts' ) || ! check_ajax_referer( 'adyzio_import', 'nonce', false ) ) {
		adyzio_ajax_fail( 'Not allowed. Reload the page and try again.' );
	}
	$jid = isset( $_POST['job'] ) ? sanitize_key( wp_unslash( $_POST['job'] ) ) : '';
	$j   = adyzio_job_get( $jid );
	if ( ! $j ) {
		adyzio_ajax_fail( 'This import has expired. Please start again.' );
	}
	if ( ! adyzio_lock_acquire() ) {
		wp_send_json( array( 'busy' => true ) ); /* another import or sync is running; the browser waits and asks again */
	}
	$j = adyzio_job_get( $jid ); /* re-read after taking the lock, in case another request moved it on */
	if ( ! $j ) {
		adyzio_lock_release();
		adyzio_ajax_fail( 'This import has expired. Please start again.' );
	}
	if ( function_exists( 'set_time_limit' ) ) {
		@set_time_limit( 120 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
	}
	$map   = adyzio_key_map();
	$total = count( $j['items'] );
	$end   = min( $total, $j['pos'] + 10 );
	$t0    = microtime( true );
	for ( $i = $j['pos']; $i < $end; $i++ ) {
		$res = adyzio_import_apply( $j['items'][ $i ], $j['opts'], $map );
		adyzio_import_count( $j['stats'], $j['notes'], $res, $j['items'][ $i ] );
		$j['pos'] = $i + 1;
		if ( microtime( true ) - $t0 > 20 ) {
			break;
		}
	}
	$done = $j['pos'] >= $total;
	$out  = array( 'pos' => $j['pos'], 'total' => $total, 'stats' => $j['stats'], 'notes' => array_slice( $j['notes'], -40 ), 'done' => $done );
	if ( $done ) {
		if ( $j['stats']['added'] || $j['stats']['updated'] ) {
			adyzio_purge_cache();
		}
		if ( 'sheet' === $j['source'] ) {
			update_option( 'adyzio_sync_last', array( 'time' => time(), 'stats' => $j['stats'], 'error' => '', 'how' => 'manual' ), false );
		}
		delete_option( 'adyzio_job_' . $j['id'] );
	} else {
		adyzio_job_save( $j );
	}
	adyzio_lock_release();
	wp_send_json( $out );
} );

/* ================= clean up duplicates ================= */

add_action( 'admin_post_adyzio_dedupe', function () {
	if ( ! current_user_can( 'manage_options' ) || ! check_admin_referer( 'adyzio_dedupe' ) ) {
		wp_die( 'Not allowed.' );
	}
	global $wpdb;
	$rows   = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		"SELECT p.ID, p.post_status, pm.meta_key, pm.meta_value FROM {$wpdb->posts} p
		 JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID AND pm.meta_key IN ('adz_key','product_link','buy_link')
		 WHERE p.post_type = 'post' AND p.post_status NOT IN ('trash','auto-draft','inherit')"
	);
	$keyof = array();
	$stat  = array();
	foreach ( (array) $rows as $r ) {
		$stat[ $r->ID ] = $r->post_status;
		if ( 'buy_link' === $r->meta_key ) {
			if ( empty( $keyof[ $r->ID ] ) ) {
				$keyof[ $r->ID ] = 'b:' . adyzio_link_norm( $r->meta_value );
			}
		} else {
			$k = 'adz_key' === $r->meta_key ? $r->meta_value : adyzio_product_key( $r->meta_value );
			if ( $k ) {
				$keyof[ $r->ID ] = 'k:' . $k;
			}
		}
	}
	$groups = array();
	foreach ( $keyof as $pid => $k ) {
		if ( strlen( $k ) > 2 ) {
			$groups[ $k ][] = (int) $pid;
		}
	}
	$trashed = 0;
	foreach ( $groups as $ids ) {
		if ( count( $ids ) < 2 ) {
			continue;
		}
		/* keep a published copy if there is one, otherwise the oldest */
		usort( $ids, function ( $a, $b ) use ( $stat ) {
			return ( ( 'publish' === $stat[ $b ] ) <=> ( 'publish' === $stat[ $a ] ) ) ?: ( $a <=> $b );
		} );
		foreach ( array_slice( $ids, 1 ) as $dup ) {
			if ( wp_trash_post( $dup ) ) {
				$trashed++;
			}
		}
	}
	if ( $trashed ) {
		adyzio_purge_cache();
	}
	wp_safe_redirect( admin_url( 'tools.php?page=adyzio-import&adz_deduped=' . $trashed ) );
	exit;
} );

/* ================= admin page ================= */

function adyzio_import_page() {
	if ( ! current_user_can( 'edit_posts' ) ) {
		return;
	}
	$tpl    = wp_nonce_url( admin_url( 'admin-post.php?action=adyzio_csv_template' ), 'adyzio_csv_template' );
	$dedupe = wp_nonce_url( admin_url( 'admin-post.php?action=adyzio_dedupe' ), 'adyzio_dedupe' );
	$terms  = get_terms( array( 'taxonomy' => 'category', 'hide_empty' => false, 'parent' => 0 ) );
	$sync   = adyzio_sync_settings();
	$last   = get_option( 'adyzio_sync_last' );
	$next   = wp_next_scheduled( 'adyzio_sheet_sync' );
	$admin  = current_user_can( 'manage_options' );
	?>
	<div class="wrap adzi">
		<h1>Adyzio Import</h1>
		<?php if ( isset( $_GET['adz_deduped'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
			<div class="notice notice-success"><p><?php echo (int) $_GET['adz_deduped']; // phpcs:ignore ?> duplicate posts moved to Trash. You can restore any of them from Posts → Trash.</p></div>
		<?php endif; ?>
		<?php if ( isset( $_GET['adz_sync_saved'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
			<div class="notice notice-success"><p>Google Sheet settings saved.</p></div>
		<?php endif; ?>

		<div class="adzi-grid">
			<div class="adzi-card">
				<h2>1. Upload a file</h2>
				<p>Your scraper's Excel file (<strong>.xlsx</strong>) as it is, or a CSV. <a href="<?php echo esc_url( $tpl ); ?>">Download the template</a></p>
				<form id="adzi-file" enctype="multipart/form-data">
					<p><input type="file" name="adyzio_csv" accept=".xlsx,.csv" required></p>
					<p><label>Category<br>
						<select name="cat_mode">
							<option value="auto">Use the Category column, or guess from the product name</option>
							<?php if ( ! is_wp_error( $terms ) ) : foreach ( $terms as $t ) : ?>
								<option value="<?php echo (int) $t->term_id; ?>">Put all rows in: <?php echo esc_html( $t->name ); ?></option>
							<?php endforeach; endif; ?>
						</select></label></p>
					<p>
						<label><input type="radio" name="status" value="draft" checked> Save new products as drafts</label><br>
						<label><input type="radio" name="status" value="publish"> Publish products that have an Affiliate Link</label>
					</p>
					<p><label><input type="checkbox" name="checked_today" value="1"> Prices in this file are correct as of "Scraped At"</label><br>
					<label><input type="checkbox" name="use_images" value="1" checked> Use the image links (only images you're allowed to use)</label></p>
					<p><button type="submit" class="button button-primary">Import deals</button></p>
				</form>
			</div>

			<?php if ( $admin ) : ?>
			<div class="adzi-card">
				<h2>2. Google Sheet auto-sync</h2>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<input type="hidden" name="action" value="adyzio_save_sync">
					<?php wp_nonce_field( 'adyzio_save_sync' ); ?>
					<p><label>Google Sheet link<br><input type="url" class="large-text" name="sheet_url" value="<?php echo esc_attr( $sync['sheet_url'] ); ?>" placeholder="https://docs.google.com/spreadsheets/d/…"></label>
					<span class="description">Same columns as the template. In Google Sheets click <strong>Share → General access → Anyone with the link → Viewer</strong>, then paste the link here. If the sheet has several tabs, open the right tab before copying the link.</span></p>
					<p><label><input type="checkbox" name="enabled" value="1" <?php checked( $sync['enabled'] ); ?>> Check the sheet automatically</label>
						<select name="interval">
							<?php foreach ( array( 'adyzio_15min' => 'every 15 minutes', 'hourly' => 'every hour', 'twicedaily' => 'twice a day', 'daily' => 'once a day' ) as $k => $l ) : ?>
								<option value="<?php echo esc_attr( $k ); ?>" <?php selected( $sync['interval'], $k ); ?>><?php echo esc_html( $l ); ?></option>
							<?php endforeach; ?>
						</select></p>
					<p><label><input type="checkbox" name="publish" value="1" <?php checked( $sync['publish'] ); ?>> Publish a product as soon as its row has an Affiliate Link</label><br>
					<label><input type="checkbox" name="prices_ok" value="1" <?php checked( $sync['prices_ok'] ); ?>> Prices in the sheet are correct as of "Scraped At"</label><br>
					<label><input type="checkbox" name="use_images" value="1" <?php checked( $sync['use_images'] ); ?>> Use the image links</label></p>
					<p><button type="submit" class="button">Save sheet settings</button>
						<?php if ( $sync['sheet_url'] ) : ?><button type="button" class="button button-primary" id="adzi-sync">Sync now</button><?php endif; ?></p>
				</form>
				<p class="adzi-meta">
					<?php if ( $last ) : ?>
						Last sync: <?php echo esc_html( human_time_diff( (int) $last['time'] ) ); ?> ago
						<?php if ( ! empty( $last['error'] ) ) : ?> · <strong style="color:#b32d2e"><?php echo esc_html( $last['error'] ); ?></strong>
						<?php else : ?> · <?php echo (int) $last['stats']['added']; ?> added, <?php echo (int) $last['stats']['updated']; ?> updated, <?php echo (int) $last['stats']['published']; ?> published<?php endif; ?><br>
					<?php endif; ?>
					<?php if ( $sync['enabled'] && $next ) : ?>Next check: in <?php echo esc_html( human_time_diff( $next ) ); ?>.<?php endif; ?>
				</p>
			</div>
			<?php endif; ?>
		</div>

		<div class="adzi-card adzi-prog" id="adzi-prog" hidden>
			<div class="adzi-top"><b id="adzi-pct">0%</b><span id="adzi-status">Starting…</span></div>
			<div class="adzi-bar"><span id="adzi-fill"></span></div>
			<svg id="adzi-chart" viewBox="0 0 640 180" role="img" aria-label="Import progress over time">
				<g class="adzi-grid-lines">
					<line x1="40" y1="20" x2="630" y2="20"/><line x1="40" y1="57.5" x2="630" y2="57.5"/><line x1="40" y1="95" x2="630" y2="95"/><line x1="40" y1="132.5" x2="630" y2="132.5"/><line x1="40" y1="170" x2="630" y2="170"/>
				</g>
				<g class="adzi-y"><text x="32" y="24">100%</text><text x="32" y="61">75%</text><text x="32" y="99">50%</text><text x="32" y="136">25%</text><text x="32" y="174">0%</text></g>
				<polyline id="adzi-line" points="40,170"/>
				<circle id="adzi-dot" cx="40" cy="170" r="5"/>
				<text id="adzi-dotlabel" x="40" y="160"></text>
			</svg>
			<p class="adzi-stats" id="adzi-stats"></p>
			<ul class="adzi-log" id="adzi-log"></ul>
		</div>

		<?php if ( $admin ) : ?>
		<div class="adzi-card">
			<h2>Clean up duplicates</h2>
			<p>Finds products posted more than once (same store link or affiliate link). It keeps one copy (the published one, or the oldest) and moves the rest to Trash, where you can restore them.</p>
			<p><a class="button" href="<?php echo esc_url( $dedupe ); ?>" onclick="return confirm('Move duplicate product posts to Trash?');">Find and remove duplicates</a></p>
		</div>
		<?php endif; ?>

		<div class="adzi-card">
			<h2>Rank Math SEO for products</h2>
			<p>Fills Rank Math for every product post: <strong>SEO title</strong> = the product name as it is · <strong>Focus keyword</strong> = short product name (plus "… price" and its child category as extra keywords) · <strong>Meta description</strong> = product name, who it suits and the store. New imports get this automatically, plus a short URL made from the product name. Fields you edited yourself in Rank Math are kept.</p>
			<p><label><input type="checkbox" id="adz-seo-intro" checked> Add a one-line intro to products that have no text (product name, store, "Good for" line; no invented details)</label><br>
			<label><input type="checkbox" id="adz-seo-force"> Also overwrite Rank Math fields I edited by hand</label></p>
			<p><button type="button" class="button button-primary" id="adz-seo-go">Apply SEO to all products</button></p>
			<div id="adz-seo-prog" hidden style="max-width:640px">
				<p style="margin:8px 0"><b id="adz-seo-pct" style="font-size:22px;color:#2a2470">0%</b> <span id="adz-seo-msg"></span></p>
				<div style="height:10px;background:#ecebfb;border-radius:99px;overflow:hidden"><span id="adz-seo-fill" style="display:block;height:100%;width:0;background:#2a2470;transition:width .3s"></span></div>
			</div>
		</div>

		<div class="adzi-card">
			<h2>How columns are used</h2>
			<p><code>Affiliate Link</code> → Buy Now button · <code>Product Link</code> → finds the same product again (so re-importing <em>updates</em> it instead of posting it twice) · <code>Product Title</code> + <code>Brand</code> → title (made from the link when it says "Image") · <code>Price (₹)</code>, <code>MRP (₹)</code> · <code>Image URL</code> / <code>Drive Image Link</code> · <code>Scraped At</code>. Optional: <code>Category</code>, <code>Subcategory</code>, <code>Deal Type</code>, <code>Good For</code>, <code>Check List</code>, <code>Description</code>, <code>Ends</code>. Rating, Reviews and Discount % are not used. Empty cells never wipe what's already saved, and posts are never unpublished or deleted by an import.</p>
		</div>
	</div>
	<style>
		.adzi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px}
		.adzi-card{background:#fff;border:1px solid #dcdcde;border-radius:10px;padding:16px 20px;margin-top:16px}
		.adzi-card h2{margin-top:4px}
		.adzi-meta{color:#50575e}
		.adzi-top{display:flex;align-items:baseline;gap:12px}
		#adzi-pct{font-size:40px;line-height:1.1;color:#2a2470;font-variant-numeric:tabular-nums}
		#adzi-status{font-size:15px;color:#50575e}
		.adzi-bar{height:12px;background:#ecebfb;border-radius:999px;overflow:hidden;margin:10px 0 14px}
		#adzi-fill{display:block;height:100%;width:0;background:#2a2470;border-radius:999px;transition:width .3s}
		.adzi-prog.is-done #adzi-fill{background:#16794a}
		.adzi-prog.is-done #adzi-pct{color:#16794a}
		.adzi-prog.is-error #adzi-pct{color:#b32d2e}
		#adzi-chart{width:100%;max-width:760px;height:auto;display:block}
		.adzi-grid-lines line{stroke:#e3e1ee;stroke-width:1}
		.adzi-y text{font-size:11px;fill:#77739a;text-anchor:end}
		#adzi-line{fill:none;stroke:#e8890c;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}
		#adzi-dot{fill:#2a2470}
		#adzi-dotlabel{font-size:12px;font-weight:700;fill:#2a2470;text-anchor:middle}
		.adzi-stats{font-size:14px}
		.adzi-log{max-height:180px;overflow:auto;background:#f6f7f7;border-radius:6px;padding:8px 12px 8px 28px;list-style:disc;font-size:13px;margin:0}
		.adzi-log:empty{display:none}
	</style>
	<script>
	(function(){
		var ajax = <?php echo wp_json_encode( admin_url( 'admin-ajax.php' ) ); ?>;
		var nonce = <?php echo wp_json_encode( wp_create_nonce( 'adyzio_import' ) ); ?>;
		var drafts = <?php echo wp_json_encode( admin_url( 'edit.php?post_type=post' ) ); ?>;
		var box = document.getElementById('adzi-prog'), pts = [], t0 = 0, running = false;
		function $(id){ return document.getElementById(id); }
		function post(data){ data.append('nonce', nonce); return fetch(ajax, {method:'POST', body:data, credentials:'same-origin'}).then(function(r){ return r.json(); }); }
		function draw(pct){
			var t = (Date.now() - t0) / 1000; pts.push([t, pct]);
			var tmax = Math.max(t, 1), w = 590, h = 150;
			var p = pts.map(function(q){ return (40 + q[0] / tmax * w).toFixed(1) + ',' + (170 - q[1] / 100 * h).toFixed(1); });
			$('adzi-line').setAttribute('points', '40,170 ' + p.join(' '));
			var last = p[p.length - 1].split(',');
			$('adzi-dot').setAttribute('cx', last[0]); $('adzi-dot').setAttribute('cy', last[1]);
			var lx = Math.min(600, Math.max(60, +last[0])); $('adzi-dotlabel').setAttribute('x', lx); $('adzi-dotlabel').setAttribute('y', Math.max(14, last[1] - 10));
			$('adzi-dotlabel').textContent = pct + '%';
		}
		function show(r){
			var pct = r.total ? Math.floor(r.pos / r.total * 100) : 100;
			$('adzi-pct').textContent = pct + '%';
			$('adzi-fill').style.width = pct + '%';
			$('adzi-status').textContent = r.done ? 'Complete · ' + r.total + ' rows' : pct + '% done · ' + r.pos + ' of ' + r.total + ' rows';
			var s = r.stats;
			$('adzi-stats').innerHTML = '<b>' + s.added + '</b> added · <b>' + s.updated + '</b> updated · ' + s.unchanged + ' unchanged · ' + s.skipped + ' skipped · <b>' + s.published + '</b> published' +
				(s.nolink ? ' · <b>' + s.nolink + '</b> need an affiliate link (saved as drafts)' : '') + (s.guessed ? ' · ' + s.guessed + ' titles made from the link' : '');
			$('adzi-log').innerHTML = (r.notes || []).map(function(n){ var li = document.createElement('li'); li.textContent = n; return li.outerHTML; }).join('');
			draw(pct);
		}
		function fail(msg){ box.classList.add('is-error'); $('adzi-status').textContent = msg; running = false; lock(false); }
		function lock(on){ document.querySelectorAll('#adzi-file button, #adzi-sync').forEach(function(b){ b.disabled = on; }); }
		function step(job){
			var fd = new FormData(); fd.append('action', 'adyzio_import_step'); fd.append('job', job);
			post(fd).then(function(r){
				if (r.error) return fail(r.error);
				if (r.busy) return setTimeout(function(){ step(job); }, 1500);
				show(r);
				if (r.done) {
					box.classList.add('is-done'); running = false; lock(false);
					$('adzi-status').innerHTML = 'Complete · ' + r.total + ' rows. <a href="' + drafts + '">View posts</a>';
				} else step(job);
			}).catch(function(){ setTimeout(function(){ step(job); }, 3000); });
		}
		function start(fd){
			if (running) return; running = true; lock(true);
			box.hidden = false; box.classList.remove('is-done', 'is-error'); pts = []; t0 = Date.now();
			$('adzi-pct').textContent = '0%'; $('adzi-fill').style.width = '0'; $('adzi-status').textContent = 'Reading…'; $('adzi-stats').textContent = ''; $('adzi-log').innerHTML = ''; draw(0);
			box.scrollIntoView({behavior:'smooth', block:'start'});
			post(fd).then(function(r){
				if (r.error) return fail(r.error);
				if (!r.total) return fail('No product rows found.');
				$('adzi-status').textContent = '0% done · 0 of ' + r.total + ' rows';
				step(r.job);
			}).catch(function(){ fail('The server did not answer. Check your connection and try again.'); });
		}
		var f = $('adzi-file');
		f.addEventListener('submit', function(e){ e.preventDefault(); var fd = new FormData(f); fd.append('action', 'adyzio_import_start'); start(fd); });
		var s = $('adzi-sync');
		if (s) s.addEventListener('click', function(){ var fd = new FormData(); fd.append('action', 'adyzio_sync_start'); start(fd); });
		var sb = $('adz-seo-go'), changed = 0;
		function seoStep(off){
			var fd = new FormData(); fd.append('action','adyzio_seo_step'); fd.append('offset', off);
			if ($('adz-seo-intro').checked) fd.append('intro','1'); if ($('adz-seo-force').checked) fd.append('force','1');
			post(fd).then(function(r){
				if (r.error) { $('adz-seo-msg').textContent = r.error; sb.disabled = false; return; }
				changed += r.changed; var pct = r.total ? Math.floor(r.next / r.total * 100) : 100;
				$('adz-seo-pct').textContent = pct + '%'; $('adz-seo-fill').style.width = pct + '%';
				$('adz-seo-msg').textContent = r.next + ' of ' + r.total + ' products · ' + changed + ' updated';
				if (!r.done) return seoStep(r.next);
				$('adz-seo-pct').style.color = '#16794a'; $('adz-seo-fill').style.background = '#16794a';
				$('adz-seo-msg').textContent = 'Complete · ' + r.total + ' products checked, ' + changed + ' updated'; sb.disabled = false;
			}).catch(function(){ setTimeout(function(){ seoStep(off); }, 2000); });
		}
		if (sb) sb.addEventListener('click', function(){ sb.disabled = true; changed = 0; $('adz-seo-prog').hidden = false; seoStep(0); });
	})();
	</script>
	<?php
}
