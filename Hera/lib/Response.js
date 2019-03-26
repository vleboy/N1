const responseTemplate = (statusCode, body, code, headers = {}) => {
  headers = {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true
  }
  return {statusCode, headers, body: JSON.stringify(body)}
}

export class ReHandler{
  static success(body = {}, headers = {}){
    Object.assign(body, {
      code : 0,
      msg : "success"
    })
    return responseTemplate(200, body, headers)
  }
  static fail(failBody, headers = {}, opts = {}){
    delete failBody.errMsg;
    Object.assign(failBody, opts);
    return responseTemplate(200, failBody,  headers)
  }
  static fail500(failBody, headers = {}, opts = {}){
    delete failBody.errMsg;
    Object.assign(failBody, opts);
    return responseTemplate(500, failBody,  headers)
  }
}

export const GeneratePolicyDocument = (principalId, effect, resource,userInfo) => {
	var authResponse = {};
	authResponse.principalId = principalId
  authResponse.context = {}
  authResponse.context.username = userInfo.username
  authResponse.context.role = userInfo.role
  authResponse.context.userId = userInfo.userId
  authResponse.context.parent = userInfo.parent
  authResponse.context.suffix = userInfo.suffix
  authResponse.context.level = userInfo.level
  authResponse.context.displayName = userInfo.displayName
  authResponse.context.msn = userInfo.msn
	if (effect && resource) {
		var policyDocument = {};
		policyDocument.Version = '2012-10-17'; // default version
		policyDocument.Statement = [];
		var statementOne = {};
		statementOne.Action = 'execute-api:Invoke'; // default action
		statementOne.Effect = effect;
		statementOne.Resource = resource;
		policyDocument.Statement[0] = statementOne;
		authResponse.policyDocument = policyDocument;
	}
	return authResponse;
}
