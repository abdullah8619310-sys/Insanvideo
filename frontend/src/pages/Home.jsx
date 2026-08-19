import DownloaderForm from '../components/DownloaderForm.jsx'
import './Home.css'

function Home() {
  return (
    <section className="home-hero">
      <div className="home-hero__inner">
        <h1 className="home-hero__title">InsanVideo Downloader</h1>
        <p className="home-hero__description">
          Paste a public Instagram photo, video, or reel link below to get
          started. InsanVideo Downloader is currently in early development.
        </p>
        <DownloaderForm />
      </div>
    </section>
  )
}

export default Home
