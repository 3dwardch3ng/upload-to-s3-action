const core = require('@actions/core');
const aws = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const klawSync = require('klaw-sync');
const { lookup } = require('mime-types');

const AWS_ACCESS_KEY_ID = core.getInput('aws_access_key_id', {
  required: false
});
const AWS_SECRET_ACCESS_KEY = core.getInput('aws_secret_access_key', {
  required: false
});
const AWS_ASSUME_ROLE_ARN = core.getInput('aws_assume_role_arn', {
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
const INCLUDED_OBJECT_TO_UPLOAD = core.getInput('included_files', {
  required: false
});
const EXCLUDED_OBJECT_TO_UPLOAD = core.getInput('exclude_files', {
  required: false
});
const OBJECT_ACL = core.getInput('object_acl', {
  required: false
});
const OBJECT_CACHE_CONTROL_MAX_AGE = core.getInput('cache_control_max_age', {
  required: false
});

const acceptedObjectAcls = [
  'private', 'public-read', 'public-read-write', 'authenticated-read',
  'bucket-owner-read', 'bucket-owner-full-control', 'log-delivery-write'
];

let OBJ_ACL;
if (!acceptedObjectAcls.includes(OBJECT_ACL)) {
  OBJ_ACL = 'private';
}

let s3Options = {};
if (AWS_ACCESS_KEY_ID !== '' && AWS_SECRET_ACCESS_KEY !== '') {
  core.info('Using AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
  s3Options['accessKeyId'] = AWS_ACCESS_KEY_ID;
  s3Options['secretAccessKey'] = AWS_SECRET_ACCESS_KEY;
} else if (AWS_ASSUME_ROLE_ARN !== '') {
  core.info('Using AWS_ASSUME_ROLE_ARN');
  let stsOptions = {
    RoleArn: AWS_ASSUME_ROLE_ARN,
    RoleSessionName: 'actions-s3-upload-session'
  };
  const sts = new aws.STS();
  sts.assumeRole(stsOptions, function (err, data) {
    if (err) {
      throw new Error(err.message);
    }
    else {
      s3Options['accessKeyId'] = data.Credentials.AccessKeyId;
      s3Options['secretAccessKey'] = data.Credentials.SecretAccessKey;
    }
  });
} else {
  throw new Error('You need to either pass in both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY or AWS_ASSUME_ROLE_ARN');
}

const s3 = new aws.S3(s3Options);

let klawSyncOptions = { nodir: true };
if (EXCLUDED_OBJECT_TO_UPLOAD) {
  const excludedObjects = EXCLUDED_OBJECT_TO_UPLOAD.split(',');
  klawSyncOptions['filter'] = item => {
    const basename = path.basename(item.path);
    return !excludedObjects.includes(basename);
  };
}
if (INCLUDED_OBJECT_TO_UPLOAD) {
  const includedObjects = INCLUDED_OBJECT_TO_UPLOAD.split(',');
  klawSyncOptions['filter'] = item => {
    const basename = path.basename(item.path);
    return includedObjects.includes(basename);
  };
}
const files = klawSync(SOURCE, klawSyncOptions);

function upload(params) {
  return new Promise(resolve => {
    s3.upload(params, (err, data) => {
      if (err) core.error(err);
      core.info(`Uploaded: ${data.Key}`);
      core.info(`Path: ${data.Location}`);
      resolve(data.Location);
    });
  });
}

function run() {
  let uploadParams = {
    Bucket: BUCKET,
    ACL: OBJ_ACL,
  };

  if (OBJECT_CACHE_CONTROL_MAX_AGE !== '-1') {
    const expire = parseInt(OBJECT_CACHE_CONTROL_MAX_AGE);
    if (expire < 0 || 604800 < expire) {
      throw new Error('"expire" input should be a number between 0 and 604800.');
    }
    uploadParams['CacheControl'] = `max-age=${expire}`;
  }


  const sourceDir = path.join(process.cwd(), SOURCE);
  return Promise.all(
    files.map(p => {
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
    core.info(`Uploaded Objects - ${locations}`);
    core.setOutput('uploaded_objects', locations);
  })
  .catch(err => {
    core.error(err);
    core.setFailed(err.message);
  });
