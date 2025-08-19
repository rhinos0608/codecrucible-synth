const createSpinner = (text) => ({
  text: text || '',
  start: function() { return this; },
  succeed: function(text) { return this; },
  fail: function(text) { return this; },
  stop: function() { return this; },
  clear: function() { return this; },
  render: function() { return this; }
});

module.exports = createSpinner;
module.exports.default = createSpinner;