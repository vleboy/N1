const Codes = {
  OK: '0',
  Error: '-1',

  ItemDuplicate: '50004',
  ItemNotExist: '50017',
  ParamError: '47003',
  TokenError: '44000',
  UserNotFound: '22011',
  InparamError: '60001',
}

const BizErr = {
  UserNotFoundErr: (errMsg = '用户未找到') => {
    return { code: Codes.UserNotFound, msg: errMsg }
  },
  ParamErr: (errMsg = '参数错误') => {
    return { code: Codes.ParamError, msg: errMsg }
  },
  ItemExistErr: (errMsg = '记录已存在') => {
    return { code: Codes.ItemDuplicate, msg: errMsg }
  },
  ItemNotExistErr: (errMsg = '记录不存在') => {
    return { code: Codes.ItemNotExist, msg: errMsg }
  },
  TokenErr: (errMsg = '身份令牌错误') => {
    return { code: Codes.TokenError, msg: errMsg }
  },
  InparamErr: (errMsg = '入参错误') => {
    return { code: Codes.InparamError, msg: errMsg }
  }
}

module.exports = {
  Codes,
  BizErr
}