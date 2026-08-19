import './MediaPreview.css'

function MediaPreview({ data }) {
  if (!data) {
    return null
  }

  const { platform, type, title, author, thumbnail, media } = data
  const hasResolvedMedia = Array.isArray(media) && media.length > 0

  return (
    <div className="media-preview">
      <p className="media-preview__meta">
        {platform || 'Unknown platform'} · {type || 'unknown type'}
      </p>
      {thumbnail && (
        <img className="media-preview__thumbnail" src={thumbnail} alt={title || 'Media preview'} />
      )}
      {title && <p className="media-preview__title">{title}</p>}
      {author && <p className="media-preview__author">By {author}</p>}
      {!hasResolvedMedia && (
        <p className="media-preview__pending">Media details for this link are not available yet.</p>
      )}
    </div>
  )
}

export default MediaPreview
