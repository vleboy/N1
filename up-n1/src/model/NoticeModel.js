const BaseModel = require('./BaseModel')
const GlobalConfig = require("../util/config")
const _ = require('lodash')
class NoticeModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.HawkeyeGameNotice,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    //主键查询
    async getNotice(noid) {
        let res = await this.getItem({
            Key: {
                "noid": noid
            }
        })
        return res.Item
    }
    //删除跑马灯
    async delNotice(noid) {
        return await this.deleteItem({
            Key: {
                'noid': noid
            }
        })
    }


}


module.exports = NoticeModel