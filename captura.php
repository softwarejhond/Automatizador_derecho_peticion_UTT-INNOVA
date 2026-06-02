<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// ===========================================================
// CONFIGURACIÓN
// ===========================================================
$apiUrl   = 'https://talento-tech.uttalento.co/webservice/rest/server.php';
$token    = '3f158134506350615397c83d861c2104';
$format   = 'json';

$username = "1053775670"; 
$courseid = 261;

$basePath     = __DIR__;
$capturasPath = $basePath . "/capturas/" . $username;
$nodePath     = "/usr/local/bin/node"; 

if (!file_exists($capturasPath)) {
    mkdir($capturasPath, 0777, true);
}

// ===========================================================
// 1. OBTENER USUARIO
// ===========================================================
$paramsUser = [
    'field' => 'username',
    'values[0]' => $username
];

$postUser = http_build_query([
    'wstoken' => $token,
    'wsfunction' => 'core_user_get_users_by_field',
    'moodlewsrestformat' => $format
] + $paramsUser);

$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postUser);

$responseUser = curl_exec($ch);
$userData = json_decode($responseUser, true);

$userid = $userData[0]['id'];
$fullname = $userData[0]['fullname'];

// ===========================================================
// 2. OBTENER MÓDULOS DEL CURSO
// ===========================================================
$postModules = http_build_query([
    'wstoken' => $token,
    'wsfunction' => 'core_course_get_contents',
    'courseid' => $courseid,
    'moodlewsrestformat' => $format
]);

curl_setopt($ch, CURLOPT_POSTFIELDS, $postModules);
$responseModules = curl_exec($ch);
$modules = json_decode($responseModules, true);

// ===========================================================
// 3. FILTRAR QUIZES CON NOTA
// ===========================================================
$urls = [];

foreach ($modules as $section) {
    if (!isset($section['modules'])) continue;

    foreach ($section['modules'] as $m) {

        if ($m['modname'] !== 'quiz') continue;

        $quizid = $m['instance'];
        $cmid   = $m['id'];

        $postGrade = http_build_query([
            'wstoken' => $token,
            'wsfunction' => 'mod_quiz_get_user_attempts',
            'quizid' => $quizid,
            'userid' => $userid,
            'moodlewsrestformat' => $format
        ]);

        curl_setopt($ch, CURLOPT_POSTFIELDS, $postGrade);
        $responseGrade = curl_exec($ch);
        $gradeData = json_decode($responseGrade, true);

        if (!empty($gradeData['attempts'])) {
            $urls[] = "https://talento-tech.uttalento.co/mod/quiz/view.php?id=" . $cmid;
        }
    }
}

curl_close($ch);

// Guardar URLs en JSON
$jsonPath = $basePath . "/urls.json";
file_put_contents($jsonPath, json_encode($urls, JSON_PRETTY_PRINT));

// ===========================================================
// 4. EJECUTAR NODE PARA GENERAR PANTALLAZOS
// ===========================================================
$cmd = escapeshellcmd("$nodePath $basePath/capturador.js $username") . " 2>&1";
exec($cmd, $output, $status);

echo "<pre>";
print_r($output);
echo "</pre>";
?>
