<?php
/**
 * Plugin Name:       Adyzio Core
 * Description:       Adyzio deals homepage, 726-category list with mega-menu, Excel/Google Sheet import with progress, Rank Math SEO for products. Version history: Settings → Adyzio.
 * Version:           1.6.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            ABD Innovations
 * Text Domain:       adyzio-core
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ADYZIO_VERSION', '1.6.0' );
define( 'ADYZIO_FILE', __FILE__ );
define( 'ADYZIO_DIR', plugin_dir_path( __FILE__ ) );
define( 'ADYZIO_URL', plugin_dir_url( __FILE__ ) );

require_once ADYZIO_DIR . 'includes/helpers.php';
require_once ADYZIO_DIR . 'includes/settings.php';
require_once ADYZIO_DIR . 'includes/meta-box.php';
require_once ADYZIO_DIR . 'includes/data.php';
require_once ADYZIO_DIR . 'includes/home.php';
require_once ADYZIO_DIR . 'includes/single.php';
require_once ADYZIO_DIR . 'includes/site.php';
require_once ADYZIO_DIR . 'includes/import.php';
require_once ADYZIO_DIR . 'includes/sync.php';
require_once ADYZIO_DIR . 'includes/seo.php';
require_once ADYZIO_DIR . 'includes/changelog.php';

/* Stop the Google Sheet schedule when the plugin is turned off; turning it back on restores it from the saved settings. */
register_deactivation_hook( __FILE__, function () {
	wp_clear_scheduled_hook( 'adyzio_sheet_sync' );
} );
add_action( 'admin_init', function () {
	$s = function_exists( 'adyzio_sync_settings' ) ? adyzio_sync_settings() : array();
	if ( ! empty( $s['enabled'] ) && ! empty( $s['sheet_url'] ) && ! wp_next_scheduled( 'adyzio_sheet_sync' ) ) {
		adyzio_sync_schedule();
	}
} );

/**
 * On activation: put [adyzio_home] on the front page (the old content is kept in a backup field)
 * and make the page full width in Kadence.
 */
register_activation_hook( __FILE__, function () {
	$front = (int) get_option( 'page_on_front' );
	if ( ! $front || get_option( 'adyzio_home_installed' ) ) {
		return;
	}
	$page = get_post( $front );
	if ( ! $page ) {
		return;
	}
	if ( false === strpos( $page->post_content, '[adyzio_home' ) ) {
		update_post_meta( $front, '_adyzio_old_content', wp_slash( $page->post_content ) );
		wp_update_post( array(
			'ID'           => $front,
			'post_content' => "<!-- wp:shortcode -->\n[adyzio_home]\n<!-- /wp:shortcode -->",
		) );
	}
	update_post_meta( $front, '_kad_post_title', 'hide' );
	update_post_meta( $front, '_kad_post_layout', 'fullwidth' );
	update_post_meta( $front, '_kad_post_content_style', 'unboxed' );
	update_post_meta( $front, '_kad_post_vertical_padding', 'hide' );
	update_option( 'adyzio_home_installed', 1 );
} );
