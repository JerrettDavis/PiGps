/**
 * dom.js — Central DOM references and small helpers.
 */

/** @param {string} id @returns {HTMLElement} */
export const $ = (id) => document.getElementById(id);

/** Set textContent of element by id. */
export function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

/** Show an element (remove hidden attribute / set display). */
export function show(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.hidden = false;
}

/** Hide an element. */
export function hide(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.hidden = true;
}

/** Add a CSS class to an element. */
export function addClass(el, cls) {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.add(cls);
}

/** Remove a CSS class from an element. */
export function removeClass(el, cls) {
  if (typeof el === 'string') el = $(el);
  if (el) el.classList.remove(cls);
}

/** Set disabled state on a button/input. */
export function setDisabled(id, disabled) {
  const el = $(id);
  if (el) el.disabled = disabled;
}

/**
 * Collected references to all major DOM nodes.
 * Populated lazily on first call to getRefs() so the module can be imported
 * before the DOM is fully parsed (though main.js runs as module so DOM is ready).
 */
let _refs = null;

export function getRefs() {
  if (_refs) return _refs;
  _refs = {
    connectBtn:      $('connectBtn'),
    disconnectBtn:   $('disconnectBtn'),
    recordBtn:       $('recordBtn'),
    downloadGpxBtn:  $('downloadGpxBtn'),
    downloadCsvBtn:  $('downloadCsvBtn'),
    clearTrackBtn:   $('clearTrackBtn'),
    rawOnBtn:        $('rawOnBtn'),
    rawOffBtn:       $('rawOffBtn'),
    statusBtn:       $('statusBtn'),
    autoReconnectCb: $('autoReconnectCb'),
    connectionPill:  $('connectionPill'),
    toastBanner:     $('toastBanner'),
    toastMsg:        $('toastMsg'),
    toastDismiss:    $('toastDismiss'),
    fixState:        $('fixState'),
    lat:             $('lat'),
    lon:             $('lon'),
    alt:             $('alt'),
    speed:           $('speed'),
    course:          $('course'),
    satSummary:      $('satSummary'),
    utc:             $('utc'),
    quality:         $('quality'),
    mode:            $('mode'),
    satsUsed:        $('satsUsed'),
    dop:             $('dop'),
    checksums:       $('checksums'),
    overflowed:      $('overflowed'),
    age:             $('age'),
    rawBytes:        $('rawBytes'),
    recordCount:     $('recordCount'),
    recordDist:      $('recordDist'),
    recordDur:       $('recordDur'),
    satRows:         $('satRows'),
    log:             $('log'),
    sky:             $('sky'),
    map:             $('map'),
  };
  return _refs;
}
