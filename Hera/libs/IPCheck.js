module.exports = class IPCheck {
    //验证ip
    validateIP(e, userInfo) {
        let loginWhiteStr = userInfo.loginWhiteList;
        if (!loginWhiteStr || loginWhiteStr == "0.0.0.0" || loginWhiteStr == 'NULL!') {
            return true
        }
        let whiteList = loginWhiteStr.split(";");
        whiteList.forEach(function (element) {
            element.trim();
        }, this)
        let sourceIp = ((e.headers["X-Forwarded-For"] || "").split(",") || [])[0]
        let allIp = whiteList.find((ip) => ip == "0.0.0.0");
        let whiteIp = whiteList.find((ip) => ip == sourceIp);
        let checkIp = true
        if (e.requestContext && e.requestContext.identity) {
            checkIp = whiteList.find((ip) => ip == e.requestContext.identity.sourceIp);
        }
        if (whiteIp || allIp || checkIp) return true;
        console.log(`白名单ip:${JSON.stringify(whiteList)}`)
        console.log(`客服端请求的ip:${sourceIp}`)
        throw '非法的ip'
    }
}