// ABI lookup by contract address. Heavy (full ABI) — import only where contracts are called.
// Every deployment shares the current contract interface.
const current = require("../config/contracts");

function abiFor() {
  return current.COMMITX_ABI;
}

module.exports = { abiFor };
