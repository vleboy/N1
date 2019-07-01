const Codes = {
  OK: '0',
  Error: '-1'
}
// 返回模板
const responseTemplate = (statusCode, body, code, headers = {}) => {
  headers = {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true
  }
  return { statusCode, headers, body: JSON.stringify(body) }
}
// 返回工具类
const Success = (body, code = Codes.OK, headers = {}) => {
  const content = {
    ...body,
    code: code
  }
  return responseTemplate(200, content, code, headers)
}
const Fail = (body, code = Codes.Error, headers = {}) => {
  const content = {
    ...body,
    code: code
  }
  return responseTemplate(200, content, code, headers)
}
const ResOK = (callback, res, code = Codes.OK) => callback(null, Success(res, code))
const ResFail = (callback, res, code = Codes.Error) => callback(null, Fail(res, code))
const ResErr = (callback, err) => ResFail(callback, { err: err }, err.code)

// 策略文档工具
const GeneratePolicyDocument = (principalId, effect, resource, userInfo) => {
  var authResponse = {}
  authResponse.principalId = principalId
  authResponse.context = {}
  authResponse.context.username = userInfo.username
  authResponse.context.role = userInfo.role
  authResponse.context.userId = userInfo.userId
  authResponse.context.parent = userInfo.parent
  authResponse.context.suffix = userInfo.suffix
  authResponse.context.level = userInfo.level
  authResponse.context.displayName = userInfo.displayName
  if (effect && resource) {
    var policyDocument = {}
    policyDocument.Version = '2012-10-17' // default version
    policyDocument.Statement = []
    var statementOne = {}
    statementOne.Action = 'execute-api:Invoke' // default action
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne
    authResponse.policyDocument = policyDocument
  }
  return authResponse
}

module.exports = {
  Success,
  Fail,
  ResOK,
  ResFail,
  ResErr,
  GeneratePolicyDocument
}

