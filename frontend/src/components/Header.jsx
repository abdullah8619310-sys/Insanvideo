import './Header.css'

function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__logo" href="/">
          Insan<span className="site-header__logo-accent">Video</span>
        </a>
        <nav className="site-header__nav" aria-label="Main navigation">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/faq">FAQ</a>
        </nav>
      </div>
    </header>
  )
}

export default Header
