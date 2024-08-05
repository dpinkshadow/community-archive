'use client'

import { useState } from 'react'

type CustomInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string
  directory?: string
}

const requiredFiles = ['account', 'tweets', 'follower', 'following']

const requiredFilePaths = requiredFiles.map((file) => `data/${file}.js`)

// Validation step
const validateContent = (content: string, expectedSchema: any) => {
  console.log('Validating content...', content.split('\n')[0])
  const dataJson = content.slice(content.indexOf('['))
  let data
  try {
    data = JSON.parse(dataJson)
  } catch (error) {
    console.error('Error parsing JSON:', error)
    return false
  }

  if (!Array.isArray(data)) {
    console.error('Data is not an array')
    return false
  }

  return data.every((item) => {
    if (typeof item !== 'object' || item === null) {
      console.error('Item is not an object:', item)
      return false
    }
    return Object.keys(expectedSchema).every((key) => key in item)
  })
}

// ... rest of the code remains the same ...

const expectedSchemas = {
  account: {
    account: {
      email: '',
      createdVia: '',
      username: '',
      accountId: '',
      createdAt: '',
      accountDisplayName: '',
    },
  },
  tweets: {
    tweet: {
      edit_info: {},
      retweeted: false,
      source: '',
      entities: {},
      display_text_range: [],
      favorite_count: '',
      id_str: '',
      truncated: false,
      retweet_count: '',
      id: '',
      created_at: '',
      favorited: false,
      full_text: '',
      lang: '',
    },
  },
  follower: { follower: { accountId: '', userLink: '' } },
  following: { following: { accountId: '', userLink: '' } },
}

export default function UploadTwitterArchive() {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<'uploading' | 'processing' | null>(
    null,
  )

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    const file = files[0]

    setIsUploading(true)
    setProgress('uploading')

    const fileContents: { [key: string]: string } = {}

    if (file.type === 'application/zip') {
      try {
        const JSZip = (await import('jszip')).default
        const zip = await JSZip.loadAsync(file)

        for (const fileName of requiredFilePaths) {
          if (!fileName.startsWith('data/') || !fileName.endsWith('.js')) {
            throw new Error(`Invalid filename format: ${fileName}`)
          }
          const zipFile =
            zip.file(fileName) ||
            zip.file(fileName.replace('tweets.js', 'tweet.js'))
          if (!zipFile) {
            throw new Error(`Required file ${fileName} not found in the zip`)
          }
          const content = await zipFile.async('string')
          const name = fileName.slice(5, -3) // Remove 'data/' prefix and '.js' suffix
          fileContents[name] = content
        }
      } catch (error) {
        console.error('Error processing zip file:', error)
        setIsUploading(false)
        setProgress(null)
        return
      }
    } else if (file.webkitRelativePath) {
      // Handle directory upload
      const directoryReader = (event.target as HTMLInputElement).webkitdirectory
      if (!directoryReader) {
        console.error(
          'Directory upload not supported. Upload a zip file instead.',
        )
        setIsUploading(false)
        setProgress(null)
        return
      }

      for (const fileName of requiredFilePaths) {
        const filePath = `${file.webkitRelativePath.split('/')[0]}/${fileName}`
        const fileEntry = Array.from(event.target.files || []).find(
          (f) => f.webkitRelativePath === filePath,
        )
        if (!fileEntry) {
          throw new Error(
            `Required file ${fileName} not found in the directory`,
          )
        }
        const name = fileName.slice(5, -3)
        fileContents[name] = await fileEntry.text()
      }
    } else {
      console.error('Please upload a zip file or a directory')
      setIsUploading(false)
      setProgress(null)
      return
    }

    console.log('Extracted files:', Object.keys(fileContents))

    for (const [fileName, content] of Object.entries(fileContents)) {
      console.log('Validating file:', fileName)
      if (
        !validateContent(
          content,
          expectedSchemas[fileName as keyof typeof expectedSchemas],
        )
      ) {
        throw new Error(`Invalid schema for ${fileName}`)
      }
    }

    // Update the content to be sent to the API
    const archive = JSON.stringify(
      Object.fromEntries(
        Object.entries(fileContents).map(([key, content]) => [
          key,
          JSON.parse(content.slice(content.indexOf('['))),
        ]),
      ),
    )
    console.log('archive:', archive)
    console.log('archive obj:', JSON.parse(archive))
    try {
      setProgress('processing')
      const response = await fetch('/api/upload-archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // slice the data from the file contents up to the first array and stringify fileContents
        body: archive,
      })

      if (response.ok) {
        const result = await response.json()
        alert(result.message)
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to upload archive')
      }
    } catch (error) {
      console.error('Error uploading archive:', error)
      alert('An error occurred while uploading archive')
    }

    setIsUploading(false)
    setProgress(null)
  }

  return (
    <div>
      <input
        type="file"
        accept=".js,.zip"
        onChange={handleFileUpload}
        disabled={isUploading}
        webkitdirectory=""
        directory=""
        multiple
        {...({} as CustomInputProps)}
      />
      {isUploading && (
        <div>
          <p>
            {progress === 'uploading' ? 'Uploading...' : 'Processing tweets...'}
          </p>
          <div
            style={{
              width: '200px',
              height: '20px',
              border: '1px solid #ccc',
              borderRadius: '10px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress === 'uploading' ? '50%' : '100%'}`,
                height: '100%',
                backgroundColor: '#4CAF50',
                transition: 'width 0.5s ease-in-out',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}