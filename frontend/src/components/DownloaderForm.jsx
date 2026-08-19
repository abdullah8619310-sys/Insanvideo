import { useState } from 'react'
import { isValidHttpUrl } from '../utils/validateUrl.js'
import './DownloaderForm.css'

function DownloaderForm() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const trimmedUrl = url.trim()

    if (trimmedUrl === '') {
      setError('Please enter a URL.')
      setStatus('')
      return
    }

    if (!isValidHttpUrl(trimmedUrl)) {
      setError('Please enter a valid http:// or https:// URL.')
      setStatus('')
      return
    }

    setError('')
    setStatus('Downloader integration coming next.')
  }

  function handleChange(event) {
    setUrl(event.target.value)
    if (error) {
      setError('')
    }
  }

  return (
    <form className="downloader-form" onSubmit={handleSubmit} noValidate>
      <label className="downloader-form__label" htmlFor="media-url">
        Media URL
      </label>
      <div className="downloader-form__row">
        <input
          id="media-url"
          className="downloader-form__input"
          type="text"
          inputMode="url"
          placeholder="Paste a public media URL (https://...)"
          value={url}
          onChange={handleChange}
          aria-invalid={error !== ''}
          aria-describedby="downloader-form-message"
        />
        <button className="downloader-form__button" type="submit">
          Download
        </button>
      </div>
      <p id="downloader-form-message" className="downloader-form__message" aria-live="polite">
        {error && <span className="downloader-form__error">{error}</span>}
        {!error && status && <span className="downloader-form__status">{status}</span>}
      </p>
    </form>
  )
}

export default DownloaderForm
