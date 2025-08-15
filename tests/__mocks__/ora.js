module.exports = {
  default: (text) => ({
    start: () => ({ succeed: () => {}, fail: () => {}, stop: () => {} }),
    succeed: () => {},
    fail: () => {},
    stop: () => {}
  })
};