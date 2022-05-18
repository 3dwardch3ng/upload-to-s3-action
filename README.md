# Upload to S3 Action
This is the Github Action to upload source directory to the destination in the S3 bucket

## Usage

### `workflow.yml` Example

Place in a `.yml` file such as this one in your `.github/workflows` folder. [Refer to the documentation on workflow YAML syntax here.](https://help.github.com/en/articles/workflow-syntax-for-github-actions)

```yaml
name: Upload to S3

on:
  push:
    branches:
      - master

jobs:
  upload:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@master
    - uses: 3dwardCh3nG/s3-to-upload-action@v1.0.3
      with:
      aws_access_key_id: ${{ secrets.AWS_KEY_ID }}
      aws_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY}}
      aws_bucket: ${{ secrets.AWS_BUCKET }}
      source: 'src_dir'
      destination: 'dest_dir'
```

## Action inputs
Please follow below to see all the inputs for the action.

| name                               | description                                                                                                          | Default Value                                                                      |
|------------------------------------|----------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| `aws_access_key_id`                | (Optional) AWS Access Key ID                                                                                         | When empty, it will use value AWS_ACCESS_KEY_ID from the environment variable.     |
| `aws_secret_access_key`            | (Optional) AWS Secret Access Key                                                                                     | When empty, it will use value AWS_SECRET_ACCESS_KEY from the environment variable. |
| `aws_bucket_name`                  | AWS Bucket Name                                                                                                      |                                                                                    |
| `source`                           | Source directory to upload                                                                                           |                                                                                    |
| `destination`                      | (Optional) Destination directory in the bucket                                                                       | / - the root of the bucket                                                         |
| `object_acl`                       | (Optional) Object ACL for the uploaded files                                                                          | private                                                                            |
| `cache_control_max_age`            | (Optional) The Cache-Control max-age for the uploaded file.                                                           |                                                                                    |
| `included_files`                    | (Optional) List of files to include in the upload. If not specified, all files will be uploaded. (Comma separated)      |                                                                                    |
| `excluded_files`                    | (Optional) List of files to exclude from upload (Comma separated)                                                     |                                                                                    |
| `delete_destination_before_upload` | (Optional) Delete all files in destination directory before upload                                                    | false                                                                              |

## License

[MIT](LICENSE)
