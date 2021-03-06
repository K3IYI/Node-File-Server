import {
  uploadDir,
  isFileUploaded,
  isFolderExist,
  moveFile,
  mergeFiles,
} from "./upload/upload";
import { upload, MulterError } from "./upload/simple-upload";

//lib
import express from "express";
import cors from "cors";
import path from "path";
import formidable from "formidable";
import bodyParser from "body-parser";
import fs from "fs";
import lz4 from "lz4";

var encoder = lz4.createEncoderStream();
// var input = fs.createReadStream("test.txt");
// var output = fs.createWriteStream("test1");
// input.pipe(encoder).pipe(output);

const app = express();

let tmpFormObj = {};

app.use(bodyParser.json());

app.use(cors({ exposedHeaders: ["Content-Disposition", ["Content-Range"]] }));

//api for file downloading
app.get("/download-file", (req, res) => {
  res.status(200).download("./public/uploaded");
});

//api to test stream upload
app.post("/stream-upload", (req, res) => {
  const writeStream = fs.createWriteStream("./public/uploaded");
  req.pipe(writeStream);
  res.status(200).send("ok");
});

//api to upload tmp form object
app.post("/tmp-form-obj", (req, res) => {
  const form = formidable();
  form.parse(req, async (err, fields) => {
    tmpFormObj.field1 = fields.field1;
    tmpFormObj.field2 = fields.field2;
    tmpFormObj.field3 = fields.field3;
    tmpFormObj.field4 = fields.field4;
    res.status(200).send("ok");
  });
});

//api to get tmp form object
app.get("/tmp-form-obj", (req, res) => {
  res.status(200).send(tmpFormObj);
});

//api to check is file exist
app.get("/check/file", (req, res) => {
  const query = req.query;
  const fileName = query.fileName;
  const fileMd5Value = query.fileMd5Value;

  //check is file exist
  //if no, return uploaded chunks if there is any
  isFileUploaded(fileName, fileMd5Value, (data) => {
    res.send(data);
  });
});

//api for upload using multer, no merge needed
app.post("/upload/multer", (req, res) => {
  upload(req, res, (err) => {
    if (err instanceof MulterError) {
      return res.status(500).json(err);
    } else if (err) {
      return res.status(500).json(err);
    }
    return res.status(200).send(req.file);
  });
});

//api for upload with custom function
//needs to call merge api after files being uploaded
app.post("/upload", (req, res) => {
  //create a temporary directory to store uploaded file
  isFolderExist(path.resolve(uploadDir, "tmp"));
  const form = formidable({
    // multiples: true,
    uploadDir: path.resolve(uploadDir, "tmp"),
  });

  form.parse(req, async (err, fields, file) => {
    // console.log(files);
    const chunkIndex = fields.chunkIndex;
    const fileMD5Value = fields.fileMD5Value;
    const folder = path.resolve(uploadDir, fileMD5Value);

    //check is the folder for uploaded file exist, folder use to store chunks
    //folder name is the MD5 value
    await isFolderExist(folder);
    const destFile = path.resolve(folder, chunkIndex);
    console.log("----------->", file.data.path, destFile);

    //move uploaded chunk from temporary folder to file folder
    //rename done within the function
    moveFile(file.data.path, destFile).then(
      (successLog) => {
        console.log(successLog);
        res.send({
          message: `chunk uploaded, current chunk number: ${chunkIndex}`,
        });
      },
      (errorLog) => {
        console.log(errorLog);
        res.send({
          error: `fail to upload chunk number: ${chunkIndex}`,
        });
      }
    );
  });
});

//api to merge uploaded file
app.post("/merge", async (req, res) => {
  const query = req.query;
  const fileMD5Value = query.fileMD5Value;
  const fileName = query.fileName;
  console.log(fileMD5Value, fileName);

  //merge file function
  await mergeFiles(fileMD5Value, fileName);
  res.send({
    message: "Done merging",
  });
});

app.listen(8000, () => {
  console.log("App running on port 8000");
});
