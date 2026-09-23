Pod::Spec.new do |s|
  s.name             = 'ivs_broadcast'
  s.version          = '1.0.0'
  s.summary          = 'INPLAYER Amazon IVS broadcasting plugin'
  s.description      = 'iOS compatibility stub for the INPLAYER IVS broadcast plugin.'
  s.homepage         = 'https://inplayer.in/'
  s.license          = { :type => 'MIT' }
  s.author           = { 'INPLAYER' => 'inplayerdigital@gmail.com' }
  s.source           = { :path => '.' }
  s.source_files     = 'Classes/**/*'
  s.platform         = :ios, '16.0'
  s.swift_version    = '5.0'
end
