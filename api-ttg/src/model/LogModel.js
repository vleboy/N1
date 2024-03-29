const BaseModel = require('./BaseModel')
const moment = require('moment')
const uuid = require('uuid/v4')
/**
 * 实际业务子类，继承于BaseModel基类
 */
module.exports = class LogModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: 'ZeusPlatformLog'
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            sn: uuid(),
            userId: 'NULL!'
        }
    }

    /**
     * 添加日志
     * @param {*} role 
     * @param {*} type 
     * @param {*} inparam 
     * @param {*} detail
     * @param {*} options
     */
    add(role, type, inparam, detail, options) {
        let log = {
            ...this.item,
            createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
            detail,
            inparams: inparam,
            ret: 'N',
            role,
            type,
            userId: inparam.userId + '',
            userName: inparam.userName
        }
        if (role == '3' && options) {
            log.betTime = options
        }
        if (log.inparams && typeof log.inparams == 'object') {
            for (let key in log.inparams) {
                if (!log.inparams[key] && (log.inparams[key] != '0' || log.inparams[key] != 0)) {
                    delete log.inparams[key]
                }
            }
        }
        this.putItem(log)
    }
}
