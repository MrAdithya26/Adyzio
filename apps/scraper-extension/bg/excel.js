// Builds the .xlsx file with SheetJS (lib/xlsx.full.min.js).
(function (g) {
  // Same columns and order as the deals template.
  const COLUMNS = [
    { key: 'sr', header: 'Sr No', width: 6 },
    { key: 'store', header: 'Store', width: 12 },
    { key: 'title', header: 'Product Title', width: 60 },
    { key: 'brand', header: 'Brand', width: 18 },
    { key: 'price', header: 'Price (₹)', width: 11 },
    { key: 'mrp', header: 'MRP (₹)', width: 11 },
    { key: 'discount', header: 'Discount %', width: 10 },
    { key: 'rating', header: 'Rating', width: 8 },
    { key: 'reviews', header: 'Reviews', width: 10 },
    { key: 'link', header: 'Product Link', width: 45, link: true },
    { key: 'affiliateLink', header: 'Affiliate Link', width: 40, link: true },
    { key: 'affiliateMethod', header: 'Conversion', width: 14 },
    { key: 'image', header: 'Image URL', width: 45, link: true },
    { key: 'driveImageLink', header: 'Drive Image Link', width: 45, link: true },
    { key: 'scrapedAt', header: 'Scraped At', width: 20 },
    { key: 'sourcePage', header: 'Source Page', width: 40, link: true },
    { key: 'category', header: 'Category', width: 22 },
    { key: 'subcategory', header: 'Subcategory', width: 22 },
    { key: 'childCategory', header: 'Child Category', width: 22 },
    { key: 'dealType', header: 'Deal Type', width: 12 },
    { key: 'goodFor', header: 'Good For', width: 30 },
    { key: 'checkList', header: 'Check List', width: 35 },
    { key: 'description', header: 'Description', width: 60 },
    { key: 'ends', header: 'Ends', width: 16 },
  ];

  const HEADER = COLUMNS.map((c) => c.header);
  const AFFILIATE_COL_INDEX = COLUMNS.findIndex((c) => c.key === 'affiliateLink'); // 0-based

  function toRow(p, i) {
    return COLUMNS.map((c) => {
      if (c.key === 'sr') return i + 1;
      const v = p[c.key];
      return v === undefined || v === null ? '' : v;
    });
  }

  function buildWorkbook(products, sheetName) {
    const rows = [HEADER, ...products.map(toRow)];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: COLUMNS.length - 1 } }) };
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    // Clickable links.
    products.forEach((p, r) => {
      COLUMNS.forEach((c, ci) => {
        if (!c.link || !p[c.key]) return;
        const ref = XLSX.utils.encode_cell({ r: r + 1, c: ci });
        if (ws[ref]) ws[ref].l = { Target: String(p[c.key]) };
      });
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Products').slice(0, 31));
    return wb;
  }

  function toBase64(wb) {
    return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  }

  function toArrayBuffer(wb) {
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }

  // Row as {header: value}, used for the Google Sheet (matched by column name).
  function toRecord(p, i) {
    const row = toRow(p, i);
    const rec = {};
    HEADER.forEach((h, ci) => { rec[h] = row[ci]; });
    return rec;
  }

  g.DealExcel = { COLUMNS, HEADER, AFFILIATE_COL_INDEX, toRow, toRecord, buildWorkbook, toBase64, toArrayBuffer };
})(self);
