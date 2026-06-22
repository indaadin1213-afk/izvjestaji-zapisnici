const fs = require('fs');
const iconv = require('iconv-lite');
const path = require('path');

// Configuration
const OUTPUT_DIR = 'C:/Users/adin.kulovic/OneDrive - Bingo d.o.o/Izvještaji';
const ZAPISNICI_CSV = 'C:/Users/adin.kulovic/Zapisnici_temp.csv';
const ODJELI_CSV = 'C:/Users/adin.kulovic/oDJELI_mapping.csv';

const warehouseMapping = {
    'Farma Ciljuge - Jaja': '3 - Farma Ciljuge - Jaja',
    'LDC Sarajevo': '4 - LDC Sarajevo',
    'CM Tuzla Neprehrana - 1031': '6 - CM Tuzla Neprehrana - 1031',
    'Neprehrana_zapisnici_1003': '7 - Neprehrana_zapisnici_1003',
    'LDC Tuzla': '8 - LDC Tuzla',
    '4_1013': '4_1013 - LDC Sarajevo ViP',
    '8_1004': '8_1004 - LDC Tuzla ViP'
};

function parseCSVLine(line, delimiter = ',') {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '\"') inQuotes = !inQuotes;
        else if (char === delimiter && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else cur += char;
    }
    result.push(cur.trim());
    return result;
}

function sanitize(str) { 
    return (str || '').toString().replace(/\"/g, '').trim(); 
}

// Load Departments Mapping
console.log('Učitavam odjele...');
const odjeliMap = {};
if (fs.existsSync(ODJELI_CSV)) {
    const odjeliData = fs.readFileSync(ODJELI_CSV, 'utf8');
    const odjeliLines = odjeliData.split(/\r?\n/);
    for (let i = 1; i < odjeliLines.length; i++) {
        if (!odjeliLines[i].trim()) continue;
        const cols = parseCSVLine(odjeliLines[i], ';');
        const art = sanitize(cols[0]);
        const odjID = sanitize(cols[1]);
        const odjName = sanitize(cols[2]);
        if (art) {
            odjeliMap[art] = { id: odjID, name: odjName };
        }
    }
}

// Read Zapisnici Data
console.log('Učitavam zapisnike...');
const dataRaw = fs.readFileSync(ZAPISNICI_CSV);
let data = dataRaw.toString('utf8');
if (data.includes('\uFFFD')) data = iconv.decode(dataRaw, 'win1250');

const lines = data.split(/\r?\n/);
const headers = parseCSVLine(lines[0]).map(h => sanitize(h));

const whIndex = headers.indexOf('Naziv skladišta');
const whCodeIndex = headers.indexOf('Skladište');
const statusIndex = headers.indexOf('StatusZ');
const reasonIndex = headers.indexOf('Razlog opis');
const codeIndex = headers.indexOf('Artikal');
const nameIndex = headers.indexOf('Naziv artikla');
const qtyIndex = headers.indexOf('KolicinaPrijavljena');
const nbcIndex = headers.indexOf('NbC');
const dateIndex = headers.indexOf('KreiranjeVrijeme');
const pjSifIndex = headers.indexOf('PjSif');
const pjNameIndex = headers.indexOf('Naziv PJ');
const controllerIndex = headers.indexOf('KontrolaKorisnik');
const vpIndex = headers.indexOf('FzFpj');
const plIndex = headers.indexOf('IzlazBroj');
const zapBrojIndex = headers.indexOf('Broj');

const records = [];

for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]);
    if (!cols[whIndex]) continue;

    let whKey = sanitize(cols[whIndex]);
    const vpVal = sanitize(cols[vpIndex]);
    const whCode = sanitize(cols[whCodeIndex]);

    if (whKey === 'LDC Tuzla' && vpVal === '1004') whKey = '8_1004';
    else if (whKey === 'LDC Sarajevo' && vpVal === '1013') whKey = '4_1013';

    const whName = warehouseMapping[whKey] || whKey;
    
    const qty = parseFloat(cols[qtyIndex]) || 0;
    const nbc = parseFloat(cols[nbcIndex]) || 0;
    const val = qty * nbc;
    
    const statusVal = sanitize(cols[statusIndex]);
    let statusLabel = 'Prijavljeno';
    if (['30', '50', '55'].includes(statusVal)) statusLabel = 'Odobreno';
    else if (statusVal === '60') statusLabel = 'Odbijeno';

    const itemCode = sanitize(cols[codeIndex]);
    const type = itemCode.toUpperCase().startsWith('T') ? 'Ambalaža' : 'Roba';
    
    const deptInfo = odjeliMap[itemCode] || { id: '-', name: 'Nepoznato' };

    records.push({
        wh: whName,
        whCode: whCode,
        status: statusLabel,
        code: itemCode,
        name: sanitize(cols[nameIndex]),
        qty: qty,
        nbc: nbc,
        val: val,
        date: sanitize(cols[dateIndex]).split(' ')[0],
        pj: sanitize(cols[pjNameIndex]) || sanitize(cols[pjSifIndex]),
        pjSif: sanitize(cols[pjSifIndex]),
        pl: sanitize(cols[plIndex]) || 'Nema PL',
        zapBroj: sanitize(cols[zapBrojIndex]),
        tip: type,
        odjelID: deptInfo.id,
        odjelName: deptInfo.name
    });
}

const htmlTemplate = `<!DOCTYPE html>
<html lang="bs">
<head>
    <meta charset="UTF-8">
    <title>BINGO d.o.o. | Logistička Analitika Zapisnika v2</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;900&family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --primary: #009640; --primary-rgb: 0, 150, 64; --secondary: #FFD700;
            --bg-body: #f8fafc; --bg-card: #ffffff; --text-primary: #0f172a; --text-secondary: #475569;
            --border: #e2e8f0; --table-header-bg: #f8fafc; --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --transition: all 0.2s ease;
        }
        body.dark-mode {
            --bg-body: #0b0f19; --bg-card: #151f32; --text-primary: #f1f5f9; --text-secondary: #cbd5e1;
            --border: #1e293b; --table-header-bg: #1e293b;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background-color: var(--bg-body); color: var(--text-primary); transition: var(--transition); line-height: 1.5; padding-bottom: 50px; }
        .container { max-width: 1600px; margin: 0 auto; padding: 0 20px; }
        header { background: var(--bg-card); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 1000; box-shadow: var(--shadow-sm); }
        .header-content { display: flex; justify-content: space-between; align-items: center; height: 70px; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .logo { width: 40px; height: 40px; background: var(--primary); border: 2px solid var(--secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-family: 'Outfit'; }
        
        .tabs { display: flex; gap: 5px; margin: 20px 0; border-bottom: 1px solid var(--border); }
        .tab-btn { padding: 10px 20px; background: none; border: none; color: var(--text-secondary); cursor: pointer; font-weight: 600; font-family: 'Outfit'; border-bottom: 3px solid transparent; }
        .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }
        .tab-content { display: none; }
        .tab-content.active { display: block; }

        .grid-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .stat-card { background: var(--bg-card); border: 1px solid var(--border); padding: 20px; border-radius: 12px; text-align: center; box-shadow: var(--shadow-sm); }
        .stat-card h4 { font-size: 11px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px; }
        .stat-val { font-size: 22px; font-weight: 800; font-family: 'Outfit'; color: var(--primary); }

        .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        
        .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px; }
        .filter-group { display: flex; flex-direction: column; gap: 4px; }
        .filter-group label { font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; }
        .form-control { padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); font-size: 13px; }

        .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: var(--table-header-bg); padding: 12px; text-align: center; font-weight: 700; border-bottom: 1px solid var(--border); cursor: pointer; position: sticky; top: 0; }
        td { padding: 10px; border-bottom: 1px solid var(--border); text-align: center; }
        tr:hover { background: rgba(var(--primary-rgb), 0.05); }

        .chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
        .chart-box { height: 350px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 15px; }

        .btn { padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); }
        .btn-primary { background: var(--primary); color: white; border-color: var(--primary); }
        
        .badge { padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
        .bg-green { background: #dcfce7; color: #15803d; }
        .bg-red { background: #fee2e2; color: #b91c1c; }
        .bg-blue { background: #dbeafe; color: #1d4ed8; }

        .pagination { display: flex; justify-content: center; gap: 5px; margin-top: 15px; }
        .page-btn { padding: 5px 10px; border-radius: 4px; border: 1px solid var(--border); cursor: pointer; }
        .page-btn.active { background: var(--primary); color: white; }
    </style>
</head>
<body>
    <header>
        <div class="container header-content">
            <div class="brand">
                <div class="logo">B</div>
                <h2 style="font-family:'Outfit'">BINGO LOGISTIKA</h2>
            </div>
            <button class="btn" onclick="document.body.classList.toggle('dark-mode')">Dark Mode</button>
        </div>
    </header>

    <div class="container">
        <div class="tabs">
            <button class="tab-btn active" onclick="showTab('tab-kpi')">Pregled</button>
            <button class="tab-btn" onclick="showTab('tab-artikli')">Artikli</button>
            <button class="tab-btn" onclick="showTab('tab-pj')">Poslovnice</button>
            <button class="tab-btn" onclick="showTab('tab-detalji')">Detaljno</button>
        </div>

        <!-- PREGLED -->
        <div id="tab-kpi" class="tab-content active">
            <div class="grid-stats">
                <div class="stat-card"><h4>Ukupno Zapisnika</h4><div class="stat-val" id="kpi-total">0</div></div>
                <div class="stat-card"><h4>Ukupno PL-ova</h4><div class="stat-val" id="kpi-pls">0</div></div>
                <div class="stat-card"><h4>Ukupna Vrijednost</h4><div class="stat-val" id="kpi-val">0 KM</div></div>
                <div class="stat-card"><h4>Odobreno (Vrijednost)</h4><div class="stat-val" id="kpi-val-ok" style="color:#009640">0 KM</div></div>
            </div>
            <div class="chart-grid">
                <div class="chart-box"><canvas id="ch-wh-art"></canvas></div>
                <div class="chart-box"><canvas id="ch-wh-pl"></canvas></div>
                <div class="chart-box"><canvas id="ch-wh-val"></canvas></div>
            </div>
        </div>

        <!-- ARTIKLI -->
        <div id="tab-artikli" class="tab-content">
            <div class="card">
                <div class="card-header">
                    <h3>Analiza Artikala</h3>
                    <button class="btn btn-primary" onclick="exportXML('art-table', 'Artikli')">XML Export</button>
                </div>
                <div class="filters">
                    <input type="text" id="art-q" class="form-control" placeholder="Traži..." oninput="renderArt()">
                    <select id="art-tip" class="form-control" onchange="renderArt()">
                        <option value="">Svi Tipovi</option>
                        <option value="Roba">Roba</option>
                        <option value="Ambalaža">Ambalaža</option>
                    </select>
                </div>
                <div class="table-wrap">
                    <table id="art-table">
                        <thead>
                            <tr>
                                <th onclick="sortArt('code')">Šifra</th>
                                <th onclick="sortArt('name')">Naziv</th>
                                <th onclick="sortArt('count')">Br. Zapisnika</th>
                                <th onclick="sortArt('val')">Vrijednost (KM)</th>
                                <th onclick="sortArt('share')">% Učešća</th>
                            </tr>
                        </thead>
                        <tbody id="art-body"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- POSLOVNICE -->
        <div id="tab-pj" class="tab-content">
            <div class="card">
                <div class="card-header">
                    <h3>Analiza Poslovnica</h3>
                    <button class="btn btn-primary" onclick="exportXML('pj-table', 'Poslovnice')">XML Export</button>
                </div>
                <div class="table-wrap">
                    <table id="pj-table">
                        <thead>
                            <tr>
                                <th onclick="sortPJ('sif')">Sifra</th>
                                <th onclick="sortPJ('name')">Naziv</th>
                                <th onclick="sortPJ('count')">Stavki</th>
                                <th onclick="sortPJ('pls')">PL-ova</th>
                                <th onclick="sortPJ('val')">Vrijednost (KM)</th>
                                <th onclick="sortPJ('share')">% Učešća</th>
                            </tr>
                        </thead>
                        <tbody id="pj-body"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- DETALJNO -->
        <div id="tab-detalji" class="tab-content">
            <div class="card">
                <div class="card-header">
                    <h3>Detaljni Podaci</h3>
                    <button class="btn btn-primary" onclick="exportXML('det-table', 'Detaljno')">XML Export</button>
                </div>
                <div class="filters">
                    <input type="text" id="det-q" class="form-control" placeholder="Traži..." oninput="state.page=1;renderDet()">
                    <select id="det-wh" class="form-control" onchange="state.page=1;renderDet()"><option value="">Sva Skladišta</option></select>
                    <select id="det-odj" class="form-control" onchange="state.page=1;renderDet()">
                        <option value="">Svi Odjeli</option>
                        <option value="1">Odjel 1</option>
                        <option value="3">Odjel 3</option>
                        <option value="5">Odjel 5</option>
                    </select>
                    <select id="det-tip" class="form-control" onchange="state.page=1;renderDet()">
                        <option value="">Svi Tipovi</option>
                        <option value="Roba">Roba</option>
                        <option value="Ambalaža">Ambalaža</option>
                    </select>
                </div>
                <div class="table-wrap">
                    <table id="det-table">
                        <thead>
                            <tr>
                                <th>PL #</th><th>Zapisnik</th><th>Artikal</th><th>Naziv</th><th>Odjel</th><th>Skladište</th><th>Poslovnica</th><th>Kol</th><th>NbC</th><th>Vrijednost</th><th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="det-body"></tbody>
                    </table>
                </div>
                <div id="det-pagination" class="pagination"></div>
            </div>
        </div>
    </div>

    <script>
        const DATA = ${JSON.stringify(records)};
        let state = {
            page: 1, pageSize: 25,
            artSort: { key: 'val', dir: -1 },
            pjSort: { key: 'val', dir: -1 }
        };

        const fNum = (n, d=2) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
        
        function showTab(id) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            event.target.classList.add('active');
            if(id==='tab-artikli') renderArt();
            if(id==='tab-pj') renderPJ();
            if(id==='tab-detalji') renderDet();
        }

        function updateKPI() {
            document.getElementById('kpi-total').textContent = DATA.length.toLocaleString('de-DE');
            document.getElementById('kpi-pls').textContent = new Set(DATA.map(r => r.pl)).size.toLocaleString('de-DE');
            const totalVal = DATA.reduce((s, r) => s + r.val, 0);
            const okVal = DATA.filter(r => r.status === 'Odobreno').reduce((s, r) => s + r.val, 0);
            document.getElementById('kpi-val').textContent = fNum(totalVal) + ' KM';
            document.getElementById('kpi-val-ok').textContent = fNum(okVal) + ' KM';
            renderCharts();
        }

        let charts = {};
        function renderCharts() {
            const whs = [...new Set(DATA.map(r => r.wh))].sort();
            const colors = whs.map((_, i) => 'hsl(' + (i * 360 / whs.length) + ', 70%, 50%)');

            const artCounts = whs.map(w => DATA.filter(r => r.wh === w).length);
            const plCounts = whs.map(w => new Set(DATA.filter(r => r.wh === w).map(x => x.pl)).size);
            const vals = whs.map(w => DATA.filter(r => r.wh === w).reduce((s, r) => s + r.val, 0));

            const totalArt = artCounts.reduce((a,b)=>a+b,0);
            const totalPl = plCounts.reduce((a,b)=>a+b,0);

            drawPie('ch-wh-art', whs, artCounts.map(v => (v/totalArt*100).toFixed(1)), 'Distribucija po Artikalima (%)', colors);
            drawPie('ch-wh-pl', whs, plCounts.map(v => (v/totalPl*100).toFixed(1)), 'Distribucija po PL-ovima (%)', colors);
            drawPie('ch-wh-val', whs, vals, 'Vrijednost po Skladištima (KM)', colors);
        }

        function drawPie(id, labels, data, title, colors) {
            if(charts[id]) charts[id].destroy();
            charts[id] = new Chart(document.getElementById(id), {
                type: 'pie',
                data: { labels, datasets: [{ data, backgroundColor: colors }] },
                options: { 
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        title: { display: true, text: title, font: { size: 14, family: 'Outfit' } },
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } }
                    }
                }
            });
        }

        function renderArt() {
            const q = document.getElementById('art-q').value.toLowerCase();
            const tip = document.getElementById('art-tip').value;
            const map = {};
            DATA.forEach(r => {
                if((!q || r.name.toLowerCase().includes(q) || r.code.includes(q)) && (!tip || r.tip === tip)) {
                    if(!map[r.code]) map[r.code] = { code: r.code, name: r.name, count: 0, val: 0 };
                    map[r.code].count++;
                    map[r.code].val += r.val;
                }
            });
            const list = Object.values(map);
            const total = list.reduce((s, r) => s + r.count, 0) || 1;
            list.forEach(a => a.share = (a.count / total * 100));
            
            list.sort((a,b) => (a[state.artSort.key] > b[state.artSort.key] ? 1 : -1) * state.artSort.dir);

            const body = document.getElementById('art-body');
            body.innerHTML = list.map(a => '<tr><td>'+a.code+'</td><td style="text-align:left">'+a.name+'</td><td>'+a.count+'</td><td style="font-weight:700">'+fNum(a.val)+'</td><td>'+a.share.toFixed(2)+'%</td></tr>').join('');
        }

        function sortArt(key) {
            if(state.artSort.key === key) state.artSort.dir *= -1;
            else { state.artSort.key = key; state.artSort.dir = -1; }
            renderArt();
        }

        function renderPJ() {
            const map = {};
            DATA.forEach(r => {
                const k = r.pjSif || r.pj;
                if(!map[k]) map[k] = { sif: r.pjSif, name: r.pj, count: 0, pls: new Set(), val: 0 };
                map[k].count++;
                map[k].pls.add(r.pl);
                map[k].val += r.val;
            });
            const list = Object.values(map);
            const total = list.reduce((s, r) => s + r.count, 0) || 1;
            list.forEach(p => { p.share = (p.count / total * 100); p.plsCount = p.pls.size; });

            list.sort((a,b) => (a[state.pjSort.key] > b[state.pjSort.key] ? 1 : -1) * state.pjSort.dir);

            const body = document.getElementById('pj-body');
            body.innerHTML = list.map(p => '<tr><td>'+p.sif+'</td><td style="text-align:left">'+p.name+'</td><td>'+p.count+'</td><td>'+p.plsCount+'</td><td style="font-weight:700">'+fNum(p.val)+'</td><td>'+p.share.toFixed(2)+'%</td></tr>').join('');
        }

        function sortPJ(key) {
            if(state.pjSort.key === key) state.pjSort.dir *= -1;
            else { state.pjSort.key = key; state.pjSort.dir = -1; }
            renderPJ();
        }

        function renderDet() {
            const q = document.getElementById('det-q').value.toLowerCase();
            const wh = document.getElementById('det-wh').value;
            const odj = document.getElementById('det-odj').value;
            const tip = document.getElementById('det-tip').value;

            const filtered = DATA.filter(r => {
                const matchQ = !q || r.name.toLowerCase().includes(q) || r.code.includes(q) || r.pl.includes(q) || r.zapBroj.includes(q) || r.pj.toLowerCase().includes(q);
                const matchWh = !wh || r.wh === wh;
                const matchOdj = !odj || r.odjelID.startsWith(odj);
                const matchTip = !tip || r.tip === tip;
                return matchQ && matchWh && matchOdj && matchTip;
            });

            const start = (state.page - 1) * state.pageSize;
            const paged = filtered.slice(start, start + state.pageSize);
            
            const body = document.getElementById('det-body');
            body.innerHTML = paged.map(r => {
                let badge = r.status === 'Odobreno' ? 'bg-green' : (r.status === 'Odbijeno' ? 'bg-red' : 'bg-blue');
                return '<tr><td>#'+r.pl+'</td><td>'+r.zapBroj+'</td><td>'+r.code+'</td><td style="text-align:left">'+r.name+'</td><td>'+r.odjelName+'</td><td>'+r.wh+'</td><td style="text-align:left">'+r.pj+'</td><td>'+fNum(r.qty)+'</td><td>'+fNum(r.nbc, 4)+'</td><td style="font-weight:700">'+fNum(r.val)+'</td><td><span class="badge '+badge+'">'+r.status+'</span></td></tr>';
            }).join('');

            renderPagination(filtered.length);
        }

        function renderPagination(total) {
            const pages = Math.ceil(total / state.pageSize);
            const wrap = document.getElementById('det-pagination');
            wrap.innerHTML = '';
            if(pages <= 1) return;
            for(let i=1; i<=Math.min(pages, 10); i++) {
                const b = document.createElement('button');
                b.className = 'page-btn' + (i === state.page ? ' active' : '');
                b.textContent = i;
                b.onclick = () => { state.page = i; renderDet(); };
                wrap.appendChild(b);
            }
        }

        function exportXML(tableId, name) {
            let table = document.getElementById(tableId);
            let rows = table.querySelectorAll('tr');
            let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40"><Worksheet ss:Name="Sheet1"><Table>';
            for(let i=0; i<rows.length; i++) {
                xml += '<Row>';
                let cells = rows[i].querySelectorAll('th, td');
                for(let j=0; j<cells.length; j++) {
                    let val = cells[j].innerText;
                    let type = isNaN(val.replace('.','').replace(',','.')) ? 'String' : 'Number';
                    if(type === 'Number') val = val.replace('.','').replace(',','.');
                    xml += '<Cell><Data ss:Type="'+type+'">'+val+'</Data></Cell>';
                }
                xml += '</Row>';
            }
            xml += '</Table></Worksheet></Workbook>';
            let blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
            let link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = name + '.xml';
            link.click();
        }

        window.onload = () => {
            const whs = [...new Set(DATA.map(r => r.wh))].sort();
            const sel = document.getElementById('det-wh');
            whs.forEach(w => { const o = document.createElement('option'); o.value = w; o.textContent = w; sel.appendChild(o); });
            updateKPI();
        };
    </script>
</body>
</html>`;

const outPath = path.join(OUTPUT_DIR, 'Izvjestaj_Zapisnici_Novi.html');
fs.writeFileSync(outPath, '\ufeff' + htmlTemplate, 'utf8');
console.log('Izvještaj generisan u: ' + outPath);
