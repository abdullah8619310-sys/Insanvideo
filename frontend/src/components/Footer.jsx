import './Footer.css'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <nav className="site-footer__nav" aria-label="Footer navigation">
          <a href="/about">About</a>
          <a href="/faq">FAQ</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
        <p className="site-footer__notice">
          InsanVideo Downloader is an independent project and is not affiliated
          with, endorsed by, or connected to Instagram, Meta Platforms, SnapInsta,
          or any other third-party platform.
        </p>
        <p className="site-footer__copyright">
          &copy; {new Date().getFullYear()} InsanVideo Downloader
        </p>
      </div>
    </footer>
  )
}

export default Footer
