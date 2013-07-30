<?php
//error_reporting(E_ALL);
//ini_set('display_errors', '1');
$mysqli = new mysqli("localhost", "root", "root", "client_map2");
if (mysqli_connect_errno()) {
    printf("Connect failed: %s\n", mysqli_connect_error());
    exit();
}
$mysql_query  = "SELECT * from clients ORDER BY name";
$result = $mysqli->query($mysql_query);
$clients = array();
$i = 0;
while ($row = $result->fetch_assoc()) {
	$row['index'] = $i;
	$clients[] = $row;
	$i += 1;
}
echo json_encode($clients);
