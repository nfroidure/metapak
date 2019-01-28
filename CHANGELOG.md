## [3.1.1](https://github.com/nfroidure/metapak/compare/v3.1.0...v3.1.1) (2019-01-28)


### Bug Fixes

* **Core:** Avoid false positive warnings ([e609347](https://github.com/nfroidure/metapak/commit/e609347))



# [3.1.0](https://github.com/nfroidure/metapak/compare/v3.0.1...v3.1.0) (2019-01-27)



## [3.0.1](https://github.com/nfroidure/metapak/compare/v3.0.0...v3.0.1) (2019-01-27)


### Bug Fixes

* **Metapak config:** Add forgotten bundle files ([7aa4c79](https://github.com/nfroidure/metapak/commit/7aa4c79))



# [3.0.0](https://github.com/nfroidure/metapak/compare/v2.0.0...v3.0.0) (2019-01-27)


### Features

* **Hooks:** Avoid running hooks transforms for non-root repos ([ccfe02b](https://github.com/nfroidure/metapak/commit/ccfe02b))


### BREAKING CHANGES

* **Hooks:** Will break for versions prior to Node 8



<a name="2.0.0"></a>
# [2.0.0](https://github.com/nfroidure/metapak/compare/v1.0.3...v2.0.0) (2018-10-21)


### Bug Fixes

* **bin/metapak.js:** fix .git path ([82bed36](https://github.com/nfroidure/metapak/commit/82bed36))



<a name="1.0.3"></a>
## [1.0.3](https://github.com/nfroidure/metapak/compare/v1.0.2...v1.0.3) (2018-02-06)


### Bug Fixes

* **metapak.js:** Accept scoped packages ([65f001f](https://github.com/nfroidure/metapak/commit/65f001f))



<a name="1.0.2"></a>
## [1.0.2](https://github.com/nfroidure/metapak/compare/v1.0.1...v1.0.2) (2017-12-03)


### Bug Fixes

* **Bin:** Print catched errors in stderr ([12bc76c](https://github.com/nfroidure/metapak/commit/12bc76c))
* **Install:** Fix post install script ([8b385c5](https://github.com/nfroidure/metapak/commit/8b385c5))



<a name="1.0.1"></a>
## [1.0.1](https://github.com/nfroidure/metapak/compare/v1.0.0...v1.0.1) (2017-12-02)


### Bug Fixes

* **Configs:** Preserve original configs sequence ([984f830](https://github.com/nfroidure/metapak/commit/984f830))
* **Dependencies:** Update debug due to its vulnerability ([28f24de](https://github.com/nfroidure/metapak/commit/28f24de))



<a name="1.0.0"></a>
# [1.0.0](https://github.com/nfroidure/metapak/compare/v0.0.21...v1.0.0) (2017-11-26)


### Bug Fixes

* **Install:** No more automatic metapak run ([3b74e80](https://github.com/nfroidure/metapak/commit/3b74e80)), closes [#11](https://github.com/nfroidure/metapak/issues/11) [#3](https://github.com/nfroidure/metapak/issues/3)


### Features

* **Assets:** Rename `_dot_` prefixed files ([9dd73f7](https://github.com/nfroidure/metapak/commit/9dd73f7)), closes [#4](https://github.com/nfroidure/metapak/issues/4)
* **Bin:** Add options for dry and safe runs ([db78e64](https://github.com/nfroidure/metapak/commit/db78e64))
* **Package:** Warn users that using `metapak` to chenges dependencies is not nice. ([79ce7e8](https://github.com/nfroidure/metapak/commit/79ce7e8)), closes [#9](https://github.com/nfroidure/metapak/issues/9)


### BREAKING CHANGES

* **Install:** Break previous metapak configurations



<a name="0.0.21"></a>
## [0.0.21](https://github.com/nfroidure/metapak/compare/v0.0.20...v0.0.21) (2017-07-15)



<a name="0.0.20"></a>
## [0.0.20](https://github.com/nfroidure/metapak/compare/v0.0.19...v0.0.20) (2017-04-14)


### Bug Fixes

* **hooks:** Fix the git hooks directory retrieval on MacOSX ([85f0d1d](https://github.com/nfroidure/metapak/commit/85f0d1d))



