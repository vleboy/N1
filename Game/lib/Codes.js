const Codes = {
  OK: '0',
  Error: '-1',

  DBError: '50001'
}
const BizErr = {
  DBErr: (errMsg = 'DBError') => {
    return { code: Codes.DBError, msg: errMsg }
  }
}


module.exports = {
  Codes,
  BizErr
}