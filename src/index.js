const core = require('@actions/core');
const aws = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const klawSync = require('klaw-sync');
const { lookup } = require('mime-types');

const INPUT_AWS_ACCESS_KEY_ID = core.getInput('aws_access_key_id', {
  required: false
});
const INPUT_AWS_SECRET_ACCESS_KEY = core.getInput('aws_secret_access_key', {
  required: false
});
const BUCKET = core.getInput('aws_bucket_name', {
  required: true
});
const SOURCE = core.getInput('source', {
  required: true
});
const DESTINATION = core.getInput('destination', {
  required: false
});
const INCLUDED_OBJECTS_TO_UPLOAD = core.getInput('included_files', {
  required: false
});
const EXCLUDED_OBJECTS_TO_UPLOAD = core.getInput('exclude_files', {
  required: false
});
const OBJECT_ACL = core.getInput('object_acl', {
  required: false
});
const OBJECT_CACHE_CONTROL_MAX_AGE = core.getInput('cache_control_max_age', {
  required: false
});
const DELETE_DESTINATION_BEFORE_UPLOAD = core.getInput('delete_destination_before_upload', {
  required: false
});

const acceptedObjectAcls = [
  'private', 'public-read', 'public-read-write', 'authenticated-read',
  'aws-exec-read', 'bucket-owner-read', 'bucket-owner-full-control'
];

let OBJ_ACL;
if (!acceptedObjectAcls.includes(OBJECT_ACL)) {
  OBJ_ACL = 'private';
} else {
  OBJ_ACL = OBJECT_ACL;
}

let s3Options = {};
if (INPUT_AWS_ACCESS_KEY_ID !== '' && INPUT_AWS_SECRET_ACCESS_KEY !== '') {
  core.debug('Using AWS credentials from input');
  s3Options['accessKeyId'] = INPUT_AWS_ACCESS_KEY_ID;
  s3Options['secretAccessKey'] = INPUT_AWS_SECRET_ACCESS_KEY;
} else {
  core.debug('Using AWS credentials from environment');
}

const s3 = new aws.S3(s3Options);

let klawSyncOptions = { nodir: true };
if (EXCLUDED_OBJECTS_TO_UPLOAD !== '') {
  core.debug('Excluding files: ' + EXCLUDED_OBJECTS_TO_UPLOAD);
  const excludedObjects = EXCLUDED_OBJECTS_TO_UPLOAD.split(',');
  klawSyncOptions['filter'] = item => {
    const basename = path.basename(item.path);
    return !excludedObjects.includes(basename);
  };
}
if (INCLUDED_OBJECTS_TO_UPLOAD !== '') {
  core.debug('Including files: ' + INCLUDED_OBJECTS_TO_UPLOAD);
  const includedObjects = INCLUDED_OBJECTS_TO_UPLOAD.split(',');
  klawSyncOptions['filter'] = item => {
    const basename = path.basename(item.path);
    return includedObjects.includes(basename);
  };
}
const files = klawSync(SOURCE, klawSyncOptions);

function upload(params) {
  return new Promise(resolve => {
    core.debug(`Uploading ${params.Key}`);
    s3.upload(params, (err, data) => {
      if (err) core.error(err);
      core.debug(`Uploaded: ${data.Key}`);
      core.debug(`Uploaded Path: ${data.Location}`);
      resolve(data.Location);
    });
  });
}

async function emptyS3Directory(bucket, dir) {
  const listParams = {
    Bucket: bucket,
    Prefix: dir
  };

  const listedObjects = await s3.listObjectsV2(listParams).promise();

  if (listedObjects.Contents.length === 0) return;

  const deleteParams = {
    Bucket: bucket,
    Delete: { Objects: [] }
  };

  listedObjects.Contents.forEach(({ Key }) => {
    core.debug(`Deleting: ${Key}`);
    deleteParams.Delete.Objects.push({ Key });
  });

  await s3.deleteObjects(deleteParams).promise();

  if (listedObjects.IsTruncated) await emptyS3Directory(bucket, dir);
}

async function run() {
  if (DELETE_DESTINATION_BEFORE_UPLOAD === 'true') {
    core.info(`Emptying S3 directory: ${DESTINATION}`);
    await emptyS3Directory(BUCKET, DESTINATION);
    core.info(`Emptied S3 directory: ${DESTINATION}`);
  }

  let uploadParams = {
    Bucket: BUCKET,
    ACL: OBJ_ACL,
  };

  if (OBJECT_CACHE_CONTROL_MAX_AGE !== '-1') {
    core.debug('Setting cache control max age to: ' + OBJECT_CACHE_CONTROL_MAX_AGE);
    const expire = parseInt(OBJECT_CACHE_CONTROL_MAX_AGE);
    if (expire < 0 || 604800 < expire) {
      throw new Error('"expire" input should be a number between 0 and 604800.');
    }
    uploadParams['CacheControl'] = `max-age=${expire}`;
  }

  core.info(`Number of files to upload: ${files.length}`);
  const sourceDir = path.join(process.cwd(), SOURCE);
  return Promise.all(
    files.map(p => {
      core.debug(`Uploading: ${p.path}`);
      const fileStream = fs.createReadStream(p.path);
      const bucketPath = path.join(DESTINATION, path.relative(sourceDir, p.path));
      uploadParams['Body'] = fileStream;
      uploadParams['Key'] = bucketPath;
      uploadParams['ContentType'] = lookup(p.path) || 'text/plain';
      return upload(uploadParams);
    })
  );
}

run()
  .then(locations => {
    core.info(`Upload competed.`);
    core.setOutput('uploaded_objects', locations);
  })
  .catch(err => {
    core.error(err);
    core.setFailed(err.message);
  });
