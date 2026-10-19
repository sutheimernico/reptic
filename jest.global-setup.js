// Runs once before the workers start, so every test sees the same zone. The DST tests in
// break.test.ts only mean something in a zone that has a DST change.
module.exports = async () => {
  process.env.TZ = 'Europe/Berlin';
};
