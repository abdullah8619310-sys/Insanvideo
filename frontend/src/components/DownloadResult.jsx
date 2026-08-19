import './DownloadResult.css'

function DownloadResult({ data }) {
  if (!data) {
    return null
  }

  const { title, items: rawItems } = data
  const items = Array.isArray(rawItems) && rawItems.length > 0 ? rawItems : null

  if (!items) {
    return (
      <div className="download-result">
        <p className="download-result__pending">Downloadable media for this link is not available yet.</p>
      </div>
    )
  }

  const isCarousel = items.length > 1

  return (
    <div className="download-result">
      {title && <p className="download-result__title">{title}</p>}
      <div className={isCarousel ? 'download-result__grid' : 'download-result__single'}>
        {items.map((item, index) => (
          <div className="download-result__item" key={item.url || index}>
            {item.thumbnail && (
              <img
                className="download-result__thumbnail"
                src={item.thumbnail}
                alt={title || 'Instagram media preview'}
              />
            )}
            {item.type === 'video' && (
              <p className="download-result__quality">Quality: {item.quality || 'Original / Best'}</p>
            )}
            <a className="download-result__button" href={item.url} download target="_blank" rel="noreferrer">
              {item.type === 'video' ? 'Download Video' : 'Download Image'}
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DownloadResult
