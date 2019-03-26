
const Util = require("../lib/athena").Util
const RegEnum = require("../lib/athena").RegEnum
class UserCheck {
    /**
     * 检查用户状态变更入参
     * @param {*} inparam 
     */
    checkStatus(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userId", type: "S", min: 36, max: 36 },
            { name: "status", type: "NN", min: 0, max: 1 }]
            , inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        if (inparam.status) {
            inparam.status = parseInt(inparam.status)
        }
    }
    /**
     * 检查sn
     * @param {*} inparam 
     */
    checkSn(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "sn", type: "S", min: 1, max: 10 }]
            , inparam)
        return [checkAttError, errorParams]
    }
}


// /**
//  * 返回密码强度等级
//  * @param {*} password 
//  */
// function passwordLevel(password) {
//     var Modes = 0;
//     for (let i = 0; i < password.length; i++) {
//         Modes |= CharMode(password.charCodeAt(i));
//     }
//     return bitTotal(Modes);
//     //CharMode函数
//     function CharMode(iN) {
//         if (iN >= 48 && iN <= 57)//数字
//             return 1;
//         if (iN >= 65 && iN <= 90) //大写字母
//             return 2;
//         if ((iN >= 97 && iN <= 122) || (iN >= 65 && iN <= 90))
//             //大小写
//             return 4;
//         else
//             return 8; //特殊字符
//     }
//     //bitTotal函数
//     function bitTotal(num) {
//         let modes = 0;
//         for (let i = 0; i < 4; i++) {
//             if (num & 1) modes++;
//             num >>>= 1;
//         }
//         return modes;
//     }
// }

module.exports = UserCheck