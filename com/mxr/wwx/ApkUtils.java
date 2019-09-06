package com.mxr.wwx;

import android.content.Context;
import android.util.Log;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.channels.FileChannel;

/**
 * Created by Administrator on 2019/8/23.
 */

public class ApkUtils {
    //获取apk 评论区内容
    static public String getComment(Context context) {
        String comment = null;
        //apk路径
        final String apkFile = context.getApplicationInfo().sourceDir;
        Log.i("comment apk路径: ", apkFile);
        RandomAccessFile raf = null;
        FileChannel fc = null;
        try {
            raf = new RandomAccessFile(apkFile, "r");
            fc = raf.getChannel();
            //评论区字节长度
            final long commentLength = findZipCommentLength(fc);
            if (commentLength == 0) {
                //评论区为空
                Log.i("comment", "评论区为空");
            } else {
                long total_len = raf.length();
                long seekIndex = total_len - commentLength;
                try {
                    raf.seek(seekIndex);
                    //读取Comment 有效长度
                    // 协议格式  总长1kb len(2byte) content 不够的部分用0x00补齐
                    int real_len = raf.readUnsignedShort(); //低位在前
                    Log.i("comment 读取Comment 有效长度:", Integer.toString(real_len));
                    byte[] buf = new byte[1024];
                    raf.read(buf);
                    comment = new String(buf, 0, real_len);
                    Log.i("comment 有效的评论:", comment);
                } catch (IOException e) {
                    Log.e("comment seek越界了", e.toString());
                }
            }
            Log.i("comment commentLength: ", Long.toString(commentLength));
        } catch (IOException e) {
            Log.e("comment 读取apk失败", e.toString());
        }
        Log.i("comment", "读取完成");
        return comment;
    }

    public static long findZipCommentLength(final FileChannel fileChannel) throws IOException {
        //中央目录记录的结尾（EOCD）
        //偏移字节描述[23]
        // 0 4中心目录签名结束= 0x06054b50
        // 4 2此磁盘的编号
        // 6 2中心目录启动的磁盘
        // 8 2此磁盘上的中央目录记录数
        // 10 2中央目录记录总数
        // 12 4中心目录的大小（字节）
        // 16 4相对于归档开始，中心目录的启动偏移
        // 20 2评论长度（n）
        // 22 n评论
        //对于没有存档注释的zip，
        // end-of-central-directory记录长度为22个字节，所以
        //我们希望从末尾找到22个字节的EOCD标记。


        final long archiveSize = fileChannel.size();
        if (archiveSize < ApkConst.ZIP_EOCD_REC_MIN_SIZE) {
            throw new IOException("APK too small for ZIP End of Central Directory (EOCD) record");
        }
        // ZIP End of Central Directory （EOCD）记录位于ZIP存档的最末端。
        //记录可以通过位于其中的4字节签名/魔法来识别
        //记录的开头。 一个复杂因素是记录是可变长度的，因为
        //评论字段。
        //定位ZIP EOCD记录的算法如下。 我们向后搜索
        // EOCD记录签名缓冲区的结尾。 每当我们找到签名时，我们都会检查
        //候选记录的评论长度使得记录的剩余部分占用
        //确切地说缓冲区中的剩余字节。 搜索是有限的，因为最大值
        //注释字段的大小为65535字节，因为该字段是无符号的16位数字。
        final long maxCommentLength = Math.min(archiveSize - ApkConst.ZIP_EOCD_REC_MIN_SIZE, ApkConst.UINT16_MAX_VALUE);
        final long eocdWithEmptyCommentStartPosition = archiveSize - ApkConst.ZIP_EOCD_REC_MIN_SIZE;
        for (int expectedCommentLength = 0; expectedCommentLength <= maxCommentLength;
             expectedCommentLength++) {
            final long eocdStartPos = eocdWithEmptyCommentStartPosition - expectedCommentLength;

            final ByteBuffer byteBuffer = ByteBuffer.allocate(4);
            fileChannel.position(eocdStartPos);
            fileChannel.read(byteBuffer);
            byteBuffer.order(ByteOrder.LITTLE_ENDIAN);

            if (byteBuffer.getInt(0) == ApkConst.ZIP_EOCD_REC_SIG) {
                final ByteBuffer commentLengthByteBuffer = ByteBuffer.allocate(2);
                fileChannel.position(eocdStartPos + ApkConst.ZIP_EOCD_COMMENT_LENGTH_FIELD_OFFSET);
                fileChannel.read(commentLengthByteBuffer);
                commentLengthByteBuffer.order(ByteOrder.LITTLE_ENDIAN);

                final int actualCommentLength = commentLengthByteBuffer.getShort(0);
                if (actualCommentLength == expectedCommentLength) {
                    return actualCommentLength;
                }
            }
        }
        throw new IOException("ZIP End of Central Directory (EOCD) record not found");
    }
}
