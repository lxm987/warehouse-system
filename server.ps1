$port = 3000
$root = "c:\Users\鸣\Desktop\仓库进销系统\project1"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Server started!"
Write-Host "Local: http://localhost:$port"
Write-Host "Press Ctrl+C to stop."

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    
    $path = $request.Url.AbsolutePath
    if ($path -eq '/') { $path = '/index.html' }
    
    $filePath = Join-Path $root -ChildPath $path.TrimStart('/')
    
    if (Test-Path $filePath -PathType Leaf) {
        $content = [IO.File]::ReadAllBytes($filePath)
        $ext = [IO.Path]::GetExtension($filePath)
        $contentType = switch ($ext) {
            '.html' { 'text/html; charset=utf-8' }
            '.css'  { 'text/css; charset=utf-8' }
            '.js'   { 'application/javascript; charset=utf-8' }
            '.json' { 'application/json; charset=utf-8' }
            '.png'  { 'image/png' }
            '.jpg'  { 'image/jpeg' }
            '.ico'  { 'image/x-icon' }
            default { 'application/octet-stream' }
        }
        $response.ContentType = $contentType
        $response.ContentLength64 = $content.Length
        $response.OutputStream.Write($content, 0, $content.Length)
    } else {
        $response.StatusCode = 404
        $errorMsg = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $response.OutputStream.Write($errorMsg, 0, $errorMsg.Length)
    }
    $response.OutputStream.Close()
}