import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeHTML, getSafeHttpUrl } from '../src/utils/sanitize.js';

test('escapes text inserted into HTML', () => {
    assert.equal(escapeHTML('<button title="x">'), '&lt;button title=&quot;x&quot;&gt;');
});

test('allows only absolute HTTP and HTTPS links', () => {
    assert.equal(getSafeHttpUrl('https://example.com/video'), 'https://example.com/video');
    assert.equal(getSafeHttpUrl('javascript:alert(1)'), null);
    assert.equal(getSafeHttpUrl('/relative/path'), null);
    assert.equal(getSafeHttpUrl('not a url'), null);
});
