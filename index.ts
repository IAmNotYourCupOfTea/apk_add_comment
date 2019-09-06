/**
 * zip解析修改zip评论区内容 在apk运行时读取评论区内容 
 * 只对安装v1打包方案生效 v1v2打包时只对Android7.0一下生效
 */
import * as fs from 'fs'
import Helper from './helper';

const testZipPath = `${__dirname}/res/hello_world-release.apk`  //
const outputPath = `${__dirname}/output/hello_world-comment.apk` //输出zip 
const propertyJosn = `${__dirname}/res/property.json`
/*
zip格式介绍:https://users.cs.jmu.edu/buchhofp/forensics/formats/pkzip.html#archivedata
*/

//zip 评论区标记

const comment_Signature_arr = [0x50, 0x4b, 0x05, 0x06]
const PROPERTY_JSON_LEN = 1024  //property.josn 最大长度
const PLACEHOLDER = 0x00 //占位符


function main() {
    getComment()
}


function getComment() {
    let content: Buffer = fs.readFileSync(testZipPath)
    //zip内容反序列
    let content_reverse = content.reverse()
    let dataView_rev = new DataView(new Uint8Array(content_reverse).buffer)
    //console.log(dataView_rev.getUint8(5))
    let comment_Signature_arr_rev = comment_Signature_arr.reverse()
    //评论标记
    let commetArr: number[] = []
    let currIndex = 0
    //已经读出的数据 字节
    let resultArr: number[] = []
    for (let i = 0; i < dataView_rev.byteLength; i++) {
        let currInfo = next_beyte(currIndex, dataView_rev)
        currIndex = currInfo.offset
        resultArr.push(currInfo.result)
        if (comment_Signature_arr_rev[commetArr.length] == currInfo.result) {
            commetArr.push(currInfo.result)
            if (commetArr.length == comment_Signature_arr_rev.length) {
                let hexArr = commetArr.map(v => { return v.toString(16) })
                console.log('comment_Signature:', hexArr.reverse())
                console.log('currIndex:', currIndex)
                break
            }
        }
    }


    //偏移4 + 16 byte 拿到 comment_len 占 2byte
    let jumpLen = 20
    //得到正序读取内容 
    let resultArr_rev = resultArr.reverse()
    //去除20字节 
    resultArr_rev = resultArr_rev.slice(jumpLen)
    //读取两个字节 得到 comment_len
    let commetDataView = new DataView(new Uint8Array(resultArr_rev).buffer)
    //评论区长度
    let comment_len = commetDataView.getUint16(0, true)
    console.log('评论区长度:', comment_len)
    //评论内容
    let comment: number[] = []
    if (comment_len == 0) {
        //评论区为空
        console.log('评论区为空')
        comment = []
    } else {
        //评论区已有内容
        comment = resultArr_rev.slice(2)
        let str = Helper.byteToString(comment)
        console.log('评论区已有内容:', str)
    }

    addComment(dataView_rev, comment_len)
}

function next_beyte(offset: number, dataView_rev: DataView) {
    let result = dataView_rev.getUint8(offset)
    console.log('result:', result)
    return { result: result, offset: ++offset }
}

function addComment(dataView_rev: DataView, comment_len: number) {
    //原有comment置空
    let arrBuf = dataView_rev.buffer.slice(comment_len)
    let dataView_1 = new DataView(arrBuf)
    //let byteArr = Helper.stringToByte(channelStr)
    dataView_1.setUint16(0, PROPERTY_JSON_LEN, false) //这个数据会被reverse 
    console.log('comment_len:', dataView_1.getUint16(0, false))
    let commentBuf = addPropertyJosn()
    if (!commentBuf) {
        return
    }
    let buf = Buffer.from(dataView_1.buffer)
    let buf_rev = buf.reverse()
    let zipBuf = Buffer.concat([buf_rev, commentBuf])
    fs.writeFileSync(outputPath, zipBuf)
    console.log('评论区修改成功')
}

function addPropertyJosn() {
    //协议格式  总长1kb len(2byte) content 不够的部分用0x00补齐
    let content = fs.readFileSync(propertyJosn)
    let dv = new DataView(new Uint8Array(content).buffer)
    let content_len = dv.byteLength
    if (content_len > PROPERTY_JSON_LEN) {
        console.error(propertyJosn, '长度超过', PROPERTY_JSON_LEN, '操作失败')
        return null
    }
    let content_buf = Buffer.from(dv.buffer)
    console.log('评论区总长度', content_buf.byteLength)
    let len_buf = Buffer.alloc(2)
    let len_dv = new DataView(new Uint8Array(len_buf).buffer)
    len_dv.setUint16(0, content_len, false) //低位在前
    len_buf = Buffer.from(len_dv.buffer)
    console.log('评论区头部长度:', len_buf.byteLength)
    //占位buf
    let placeBuf = Buffer.alloc(PROPERTY_JSON_LEN - 2 - content_len, PLACEHOLDER)
    console.log('占位符长度:', placeBuf.byteLength)
    let commentBuf = Buffer.concat([len_buf, content, placeBuf])
    console.log('评论区总长度:', commentBuf.length)
    return commentBuf
}

main()
