// RGB + NDVI + KVI2 only (clean minimal script)
// Author: Thuan Ha (prepared with ChatGPT)
// Date: 2025-11-07
// Usage: Paste into https://code.earthengine.google.com/ or keep in a repo as .js.
//
// =============== CONFIG ===============
var IMAGE_ASSET = 'projects/ee-thuan-ha/assets/KOCHIA2025/img_input/LuckyLake/LuckyLake13_1070278_509802_T12UYB_2022';

// Rescaling choice for KVI2 → [0,1]
var USE_PERCENTILES = true;         // false => use FIXED_LO/FIXED_HI
var FIXED_LO = -0.2, FIXED_HI = 0.6;

// Visualization
var RGB_VIS  = {bands: ['b3','b2','b1'], min: 500, max: 3000, gamma: 1.1};
var NDVI_VIS = {min: 0, max: 0.9, palette: ['#8b0000','#ffd37f','#a6d96a','#1a9850']};
var KVI_VIS  = {min: 0, max: 0.6, palette: ['#0000da','#2c7fb8','#7fcdbb','#ffffbf','#f46d43','#a50026']};

// =============== LOAD IMAGE ===============
var image = ee.Image(IMAGE_ASSET);
var roi   = image.geometry();
Map.setOptions('SATELLITE');
Map.centerObject(image, 13);

// =============== HELPERS ===============
function ND(img, a, b){ return img.normalizedDifference([a, b]); }
function rescale01(img, lo, hi) {
  return img.subtract(lo).divide(hi.subtract(lo).max(1e-6)).clamp(0, 1);
}

// =============== INDICES WE KEEP ===============
// NDVI (for masking/visualization)
var NDVI = ND(image, 'b8','b4').rename('NDVI');

// KVI2 = ND(b6,b5) × NDMI, where NDMI = ND(b8,b11)
var NDMI = ND(image, 'b8','b11');  // internal only (not exported)
var KVI2_raw = ND(image,'b6','b5').multiply(NDMI).rename('KVI2');

// =============== RESCALE KVI2 TO [0,1] ===============
var vegMask = NDVI.gt(0.2);
var lo, hi;
if (USE_PERCENTILES) {
  var stats = KVI2_raw.updateMask(vegMask).reduceRegion({
    reducer: ee.Reducer.percentile([2, 98]),
    geometry: roi, scale: 10, bestEffort: true
  });
  lo = ee.Number(stats.get('KVI2_p2'));
  hi = ee.Number(stats.get('KVI2_p98'));
} else {
  lo = ee.Number(FIXED_LO);
  hi = ee.Number(FIXED_HI);
}
var KVI2_01 = rescale01(KVI2_raw, lo, hi).rename('KVI2_01');

// =============== BUILD OUTPUT (RGB + NDVI + KVI2_01) ===============
var RGB = image.select(['b3','b2','b1']).rename(['RGB_b3','RGB_b2','RGB_b1']);
var out = RGB.addBands([NDVI, KVI2_01]);

// =============== DISPLAY ===============
Map.addLayer(RGB,  RGB_VIS,  'RGB (b3,b2,b1)');
Map.addLayer(NDVI, NDVI_VIS, 'NDVI');
Map.addLayer(KVI2_01, KVI_VIS, 'KVI2 (0–1)');

// =============== OPTIONAL: EXPORT ===============
// (A) To Drive
// Export.image.toDrive({
//   image: out,
//   description: 'RGB_NDVI_KVI2_out',
//   folder: 'GEE_Exports',
//   region: roi,
//   scale: image.projection().nominalScale(),
//   maxPixels: 1e13
// });

// (B) To Asset
// Export.image.toAsset({
//   image: out,
//   description: 'RGB_NDVI_KVI2_asset',
//   assetId: 'projects/ee-thuan-ha/assets/KOCHIA2025/derived/RGB_NDVI_KVI2_out',
//   region: roi,
//   scale: image.projection().nominalScale(),
//   maxPixels: 1e13
// });
