const Codes = {
  OK: '0',
  Error: '-1',

  ItemDuplicate: '50004',
  JSONParseError: '50006',
  MsnFullError: '50011',
  BalanceError: '50013',
  NickExistError: '50014',
  UserExistSnError: '50015',

  ParamError: '47003',
  TokenError: '44000',
  PasswordError: '40017',

  DuplicateUser: '21001',
  UserNotFound: '22011',
  UserLocked: '22012',

  InparamError: '60001',
  CaptchaErr: '60002',

  TcpError: '60004',
  PushMerchantError: "60006",

  TokenExpire: '90001',
}

const BizErr = {
  JSONParseErr: (errMsg = 'JSON转换错误，请检查入参JSON格式') => {
    return { code: Codes.JSONParseError, msg: errMsg }
  },
  UserExistErr: (errMsg = '用户已存在') => {
    return { code: Codes.DuplicateUser, msg: errMsg }
  },
  UserExistSn: (errMsg = '标识已存在') => {
    return { code: Codes.UserExistSnError, msg: errMsg }
  },
  NickExistErr: (errMsg = '昵称已存在') => {
    return { code: Codes.NickExistError, msg: errMsg }
  },
  UserNotFoundErr: (errMsg = '用户未找到') => {
    return { code: Codes.UserNotFound, msg: errMsg }
  },
  UserLockedErr: (errMsg = '用户已锁定') => {
    return { code: Codes.UserLocked, msg: errMsg }
  },
  PasswordErr: (errMsg = '密码错误') => {
    return { code: Codes.PasswordError, msg: errMsg }
  },
  ParamErr: (errMsg = '参数错误') => {
    return { code: Codes.ParamError, msg: errMsg }
  },
  ItemExistErr: (errMsg = '记录已存在') => {
    return { code: Codes.ItemDuplicate, msg: errMsg }
  },
  TokenErr: (errMsg = '身份令牌错误') => {
    return { code: Codes.TokenError, msg: errMsg }
  },
  MsnFullError: (errMsg = '线路号已全部分配') => {
    return { code: Codes.MsnFullError, msg: errMsg }
  },
  InparamErr: (errMsg = '入参错误') => {
    return { code: Codes.InparamError, msg: errMsg }
  },
  CaptchaErr: (errMsg = '验证码错误') => {
    return { code: Codes.CaptchaErr, msg: errMsg }
  },
  BalanceErr: (errMsg = '余额不足') => {
    return { code: Codes.BalanceError, msg: errMsg }
  },
  TcpErr: (errMsg = 'tcp connection error') => {
    return { code: Codes.TcpError, msg: errMsg }
  },
  PushMerchantError: (errMsg = "推送商户错误") => {
    return { code: Codes.PushMerchantError, msg: errMsg }
  },
  TokenExpire: (errMsg = 'TOKEN已过期') => {
    return { code: Codes.TokenExpire, msg: errMsg }
  }
}

module.exports = {
  Codes,
  BizErr
}