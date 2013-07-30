<?php

error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('auto_detect_line_endings', true);

// Connect to our database
$mysqli = new mysqli("localhost", "root", "root", "client_map2");
if (mysqli_connect_errno()) {
    printf("Connect failed: %s\n", mysqli_connect_error());
    exit();
}

$mapquest_api_key = "Fmjtd%7Cluub2g022h%2Cag%3Do5-9ubn10";

// the file to get imported
$file = 'csv/clients.csv'; 

// the delimiter that is used in csv file
$delimiter = ',';
 
// open the .csv file for reading
$handle = fopen($file, "r");
 
// arrays
$csv_array = array();

if ($handle) {
	while (($shop_data = fgetcsv($handle, 0, $delimiter)) !== false) {
		$csv_array[] = $shop_data;
	}
	fclose($handle);

	$address_array = array();
	$i = 0;
	$max = count($csv_array);
	while ($i < $max) {
		$shop = $csv_array[$i];
		$address_array[] = '<location><street>' . $shop[3] ." ". $shop[4] .", ". $shop[5] ." ". $shop[6] . '</street></location>';
		$i += 1;
	}

	$xml_string = '<batch><locations>' . implode('', $address_array) . '</locations></batch>';
	$postdata = http_build_query(array('xml' => $xml_string));
	$opts = array('http' => array(
		'method'  => 'POST',
		'header'  => 'Content-type: application/x-www-form-urlencoded',
		'content' => $postdata
	));
	$context  = stream_context_create($opts);
	$result = json_decode(file_get_contents('http://platform.beta.mapquest.com/geocoding/v1/batch?key='.$mapquest_api_key.'&inFormat=xml&outFormat=json', false, $context));
	if (count($csv_array) === count($result->results)) {
		for ($i = 0; $i < $max; $i += 1) {
			$csv_array[$i][] = $result->results[$i]->locations[0]->latLng->lat;
			$csv_array[$i][] = $result->results[$i]->locations[0]->latLng->lng;
		}
	}
	
	//echo '<pre>';
	//print_r($csv_array);
	//echo '</pre>';

	$insert_data  = array();

	foreach ($csv_array as $data) {
		$sh_name = $mysqli->real_escape_string($data[0]);
		$sh_phone = $mysqli->real_escape_string($data[1]);
		$sh_website = $mysqli->real_escape_string($data[2]);
		$sh_address = $mysqli->real_escape_string($data[3]);
		$sh_city = $mysqli->real_escape_string($data[4]);
		$sh_state = $mysqli->real_escape_string($data[5]);
		$sh_zip = $mysqli->real_escape_string($data[6]);
		$sh_lat = $mysqli->real_escape_string($data[7]);
		$sh_lng = $mysqli->real_escape_string($data[8]);

		$insert_data[] = "('$sh_name', '$sh_phone', '$sh_website', '$sh_address', '$sh_city', '$sh_state', '$sh_zip', '$sh_lat', '$sh_lng')";
	}

	$mysql_query  = "INSERT INTO `clients` (`name`, `phone`, `website`, `address`, `city`, `state`, `zip`, `lat`, `lng`)";
	$mysql_query .= " VALUES ".implode(', ', $insert_data);

	$success = $mysqli->query($mysql_query);
	if (!$success) {
		printf("%s\n", $mysqli->error);
   		exit;
	}
}
