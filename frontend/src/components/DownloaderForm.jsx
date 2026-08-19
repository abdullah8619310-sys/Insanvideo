import { useState } from 'react'
import { isValidHttpUrl } from '../utils/validateUrl.js'
import { requestDownload } from '../services/downloadService.js'
import DownloadResult from './DownloadResult.jsx'
import './DownloaderForm.css'

function DownloaderForm() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [message, setMessage] = useState('')
  const [resultData, setResultData] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()

    if (status === 'loading') {
      return
    }

    const trimmedUrl = url.trim()

    if (trimmedUrl === '') {
      setStatus('error')
      setMessage('Please enter a URL.')
      return
    }

    if (!isValidHttpUrl(trimmedUrl)) {
      setStatus('error')
      setMessage('Please enter a valid http:// or https:// URL.')
      return
    }

    setStatus('loading')
    setMessage('')
    setResultData(null)

    try {
      const result = await requestDownload(trimmedUrl)
      setStatus('success')
      setMessage(result?.message || 'Media found successfully.')
      setResultData(result?.data || null)
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  function handleChange(event) {
    setUrl(event.target.value)
    if (status !== 'idle' && status !== 'loading') {
      setStatus('idle')
      setMessage('')
      setResultData(null)
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
      setStatus('idle')
      setMessage('')
      setResultData(null)
    } catch {
      setStatus('error')
      setMessage('Unable to read clipboard. Please paste the URL manually.')
    }
  }

  const isLoading = status === 'loading'

  return (
    <form className="downloader-form" onSubmit={handleSubmit} noValidate>
      <label className="downloader-form__label" htmlFor="media-url">
        Instagram Media URL
      </label>
      <div className="downloader-form__row">
        <input
          id="media-url"
          className="downloader-form__input"
          type="text"
          inputMode="url"
          placeholder="Paste an Instagram photo, video, or reel link"
          value={url}
          onChange={handleChange}
          aria-invalid={status === 'error'}
          aria-describedby="downloader-form-message"
        />
        <button
          className="downloader-form__paste-button"
          type="button"
          onClick={handlePaste}
        >
          Paste
        </button>
        <button className="downloader-form__button" type="submit" disabled={isLoading}>
          {isLoading ? 'Fetching media…' : 'Download'}
        </button>
      </div>
      <p id="downloader-form-message" className="downloader-form__message" aria-live="polite">
        {status === 'error' && <span className="downloader-form__error">{message}</span>}
        {(status === 'loading' || status === 'success') && (
          <span className="downloader-form__status">{isLoading ? 'Fetching media…' : message}</span>
        )}
      </p>
      {status === 'success' && <DownloadResult data={resultData} />}
    </form>
  )
}

export default DownloaderForm
