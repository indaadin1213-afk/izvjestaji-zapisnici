$ErrorActionPreference = "Stop"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$odjeliPath = (Get-Item "C:\Users\adin.kulovic\OneDrive - Bingo d.o.o\Izvj*\oDJELI.xlsx").FullName
$zapisniciPath = (Get-Item "C:\Users\adin.kulovic\OneDrive - Bingo d.o.o\Izvj*\Zapisnici.xlsx").FullName

$mappingCsv = "C:\Users\adin.kulovic\oDJELI_mapping.csv"
$zapisniciCsv = "C:\Users\adin.kulovic\Zapisnici_temp.csv"

try {
    Write-Host "Konvertujem Zapisnike..."
    $wb1 = $excel.Workbooks.Open($zapisniciPath)
    $wb1.Sheets.Item(1).SaveAs($zapisniciCsv, 6)
    $wb1.Close($false)
    
    Write-Host "Ekstraktujem Odjele (ovo može potrajati)..."
    $wb2 = $excel.Workbooks.Open($odjeliPath)
    $ws2 = $wb2.Sheets.Item(1)
    $lastRow = $ws2.UsedRange.Rows.Count
    "Artikal;OdjelID;NazivOdjela" | Out-File $mappingCsv -Encoding utf8
    for ($r = 2; $r -le $lastRow; $r += 20000) {
        $endR = [Math]::Min($r + 19999, $lastRow)
        $vals = $ws2.Range("A$r", "AB$endR").Value2
        $lines = New-Object System.Collections.Generic.List[string]
        for ($i = 1; $i -le $vals.GetLength(0); $i++) {
            if ($vals[$i, 1]) { $lines.Add("$($vals[$i, 1]);$($vals[$i, 21]);$($vals[$i, 28])") }
        }
        $lines | Out-File $mappingCsv -Append -Encoding utf8
    }
    $wb2.Close($false)
    Write-Host "Gotovo."
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
