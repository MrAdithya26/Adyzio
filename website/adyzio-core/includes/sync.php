<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/*
 * Google Sheet auto-sync.
 * The site downloads the sheet on a schedule (WordPress cron), then runs the same import as a file upload:
 * new rows become posts, changed rows update their post, and rows that now have an Affiliate Link are published.
 * Rows removed from the sheet are left alone on the site (nothing is deleted automatically).
 */

function adyzio_sync_settings() {
	$s = get_option( 'adyzio_sync', array() );
	return wp_parse_args( is_array( $s ) ? $s : array(), array(
		'sheet_url'  => '',
		'enabled'    => false,
		'interval'   => 'adyzio_15min',
		'publish'    => true,
		'prices_ok'  => false,
		'use_images' => true,
	) );
}

/** Import options used by the sync. */
function adyzio_sync_opts() {
	$s = adyzio_sync_settings();
	return array(
		'publish'    => (bool) $s['publish'],
		'prices_ok'  => (bool) $s['prices_ok'],
		'use_images' => (bool) $s['use_images'],
		'cat_mode'   => 'auto',
	);
}

add_filter( 'cron_schedules', function ( $s ) {
	$s['adyzio_15min'] = array( 'interval' => 900, 'display' => 'Every 15 minutes (Adyzio)' );
	return $s;
} );

/** (Re)schedule the sync from the saved settings. */
function adyzio_sync_schedule() {
	wp_clear_scheduled_hook( 'adyzio_sheet_sync' );
	$s = adyzio_sync_settings();
	if ( $s['enabled'] && $s['sheet_url'] ) {
		wp_schedule_event( time() + 60, $s['interval'], 'adyzio_sheet_sync' );
	}
}

add_action( 'admin_post_adyzio_save_sync', function () {
	if ( ! current_user_can( 'manage_options' ) || ! check_admin_referer( 'adyzio_save_sync' ) ) {
		wp_die( 'Not allowed.' );
	}
	$iv = isset( $_POST['interval'] ) ? sanitize_key( wp_unslash( $_POST['interval'] ) ) : 'adyzio_15min';
	update_option( 'adyzio_sync', array(
		'sheet_url'  => isset( $_POST['sheet_url'] ) ? esc_url_raw( trim( wp_unslash( $_POST['sheet_url'] ) ) ) : '',
		'enabled'    => ! empty( $_POST['enabled'] ),
		'interval'   => in_array( $iv, array( 'adyzio_15min', 'hourly', 'twicedaily', 'daily' ), true ) ? $iv : 'adyzio_15min',
		'publish'    => ! empty( $_POST['publish'] ),
		'prices_ok'  => ! empty( $_POST['prices_ok'] ),
		'use_images' => ! empty( $_POST['use_images'] ),
	), false );
	adyzio_sync_schedule();
	wp_safe_redirect( admin_url( 'tools.php?page=adyzio-import&adz_sync_saved=1' ) );
	exit;
} );

/** Any Google Sheets link → a CSV download link for the open tab. */
function adyzio_sheet_csv_url( $u ) {
	$u = trim( (string) $u );
	if ( preg_match( '#docs\.google\.com/spreadsheets/d/e/[^/]+/pub#', $u ) ) {
		if ( false !== strpos( $u, 'output=' ) ) {
			return preg_replace( '/output=\w+/', 'output=csv', $u );
		}
		return $u . ( false === strpos( $u, '?' ) ? '?' : '&' ) . 'output=csv';
	}
	if ( preg_match( '#docs\.google\.com/spreadsheets/d/([A-Za-z0-9_-]+)#', $u, $m ) ) {
		$gid = preg_match( '/[#&?]gid=(\d+)/', $u, $g ) ? $g[1] : '';
		return 'https://docs.google.com/spreadsheets/d/' . $m[1] . '/export?format=csv' . ( $gid ? '&gid=' . $gid : '' );
	}
	return $u;
}

/** Download the sheet as rows, or WP_Error with a plain-language reason. */
function adyzio_sheet_fetch() {
	$s = adyzio_sync_settings();
	if ( ! $s['sheet_url'] ) {
		return new WP_Error( 'nourl', 'Add your Google Sheet link first.' );
	}
	$res = wp_remote_get( adyzio_sheet_csv_url( $s['sheet_url'] ), array( 'timeout' => 30, 'redirection' => 5 ) );
	if ( is_wp_error( $res ) ) {
		return new WP_Error( 'net', 'Could not reach Google Sheets: ' . $res->get_error_message() );
	}
	$code = wp_remote_retrieve_response_code( $res );
	$body = wp_remote_retrieve_body( $res );
	$type = (string) wp_remote_retrieve_header( $res, 'content-type' );
	if ( 200 !== (int) $code || false !== stripos( $type, 'text/html' ) || 0 === stripos( ltrim( $body ), '<!doctype' ) ) {
		return new WP_Error( 'access', 'Google did not share the sheet. In Google Sheets click Share → General access → "Anyone with the link" → Viewer, then try again.' );
	}
	$fh = fopen( 'php://temp', 'r+' ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	fwrite( $fh, $body ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	rewind( $fh );
	$rows = array();
	while ( ( $r = fgetcsv( $fh ) ) !== false ) {
		$rows[] = array_map( 'trim', array_map( 'strval', $r ) );
	}
	fclose( $fh ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	return $rows;
}

/** Scheduled run: fetch and import the whole sheet in one go. */
add_action( 'adyzio_sheet_sync', 'adyzio_sheet_sync_run' );
function adyzio_sheet_sync_run() {
	if ( ! adyzio_lock_acquire() ) {
		return; /* an import or another sync is running; the next scheduled run will catch up */
	}
	if ( function_exists( 'set_time_limit' ) ) {
		@set_time_limit( 600 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
	}
	$stats = adyzio_import_stats();
	$notes = array();
	$rows  = adyzio_sheet_fetch();
	$error = '';
	if ( is_wp_error( $rows ) ) {
		$error = $rows->get_error_message();
	} else {
		$prep = adyzio_import_prepare( $rows );
		if ( $prep['error'] ) {
			$error = $prep['error'];
		} else {
			$map  = adyzio_key_map();
			$opts = adyzio_sync_opts();
			foreach ( $prep['items'] as $d ) {
				$res = adyzio_import_apply( $d, $opts, $map );
				adyzio_import_count( $stats, $notes, $res, $d );
			}
			if ( $stats['added'] || $stats['updated'] ) {
				adyzio_purge_cache();
			}
		}
	}
	update_option( 'adyzio_sync_last', array( 'time' => time(), 'stats' => $stats, 'error' => $error, 'how' => 'auto' ), false );
	adyzio_lock_release();
}
