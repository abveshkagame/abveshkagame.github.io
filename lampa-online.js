(function () {
    'use strict';

    if (window.lampa_combo_online_ready) return;
    window.lampa_combo_online_ready = true;

    var FILMIX_URL = 'https://lampaplugins.github.io/store/fx.js';
    var COLLAPS_BASE = 'https://api.delivembd.ws/embed/';

    function log(message, detail) {
        if (detail) console.log('[Lampa Online] ' + message, detail);
        else console.log('[Lampa Online] ' + message);
    }

    function escapeHtml(value) {
        if (window.Lampa && Lampa.Utils && Lampa.Utils.escape) {
            return Lampa.Utils.escape(value || '');
        }

        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function loadScript(url, name, callback) {
        var script = document.createElement('script');

        script.src = url;
        script.async = true;

        script.onload = function () {
            log(name + ' loaded');
            callback && callback(true);
        };

        script.onerror = function () {
            log(name + ' load failed');
            callback && callback(false);
        };

        document.head.appendChild(script);
    }

    function lang(key, fallback) {
        try {
            var translated = Lampa.Lang.translate(key);
            return translated && translated !== key ? translated : fallback;
        }
        catch (e) {
            return fallback;
        }
    }

    function addCollapsTemplates() {
        if (Lampa.Template && Lampa.Template.add) {
            Lampa.Template.add('collaps_online_item', '<div class="online selector">' +
                '<div class="online__body">' +
                    '<div style="position:absolute;left:0;top:-0.3em;width:2.4em;height:2.4em">' +
                        '<svg style="height:2.4em;width:2.4em" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                            '<circle cx="64" cy="64" r="56" stroke="white" stroke-width="16"/>' +
                            '<path d="M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z" fill="white"/>' +
                        '</svg>' +
                    '</div>' +
                    '<div class="online__title" style="padding-left:2.1em">{title}</div>' +
                    '<div class="online__quality" style="padding-left:3.4em">{quality}{info}</div>' +
                '</div>' +
            '</div>');
        }
    }

    function addCollapsLang() {
        if (!Lampa.Lang || !Lampa.Lang.add) return;

        Lampa.Lang.add({
            title_online_collaps: {
                ru: 'Collaps',
                uk: 'Collaps',
                en: 'Collaps',
                zh: 'Collaps',
                bg: 'Collaps'
            },
            collaps_no_kp: {
                ru: 'Для Collaps нужен kinopoisk_id в карточке',
                uk: 'Для Collaps потрібен kinopoisk_id у картці',
                en: 'Collaps needs kinopoisk_id in the card',
                zh: 'Collaps needs kinopoisk_id in the card',
                bg: 'Collaps needs kinopoisk_id in the card'
            },
            collaps_no_streams: {
                ru: 'Collaps не вернул воспроизводимые потоки',
                uk: 'Collaps не повернув відтворювані потоки',
                en: 'Collaps returned no playable streams',
                zh: 'Collaps returned no playable streams',
                bg: 'Collaps returned no playable streams'
            }
        });
    }

    function CollapsComponent(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var Files = Lampa.Files || Lampa.Explorer;
        var files = new Files(object);
        var filter = new Lampa.Filter(object);
        var extract = null;
        var items = [];
        var last;
        var choice = { season: 0 };
        var self = this;

        function movie() {
            return object.movie || {};
        }

        function kpInfo() {
            var card = movie();
            var fields = [
                ['kinopoisk_id', card.kinopoisk_id],
                ['kp_id', card.kp_id],
                ['filmId', card.filmId],
                ['kinopoiskId', card.kinopoiskId]
            ];

            log('Collaps KP fields', {
                kinopoisk_id: card.kinopoisk_id,
                kp_id: card.kp_id,
                filmId: card.filmId,
                kinopoiskId: card.kinopoiskId
            });

            for (var i = 0; i < fields.length; i++) {
                if (fields[i][1]) {
                    return {
                        id: fields[i][1],
                        path: fields[i][0]
                    };
                }
            }

            return {
                id: '',
                path: ''
            };
        }

        function title() {
            var card = movie();
            return card.title || card.name || card.original_title || card.original_name || 'Collaps';
        }

        function renderRoot() {
            return files.render();
        }

        function appendFiles() {
            if (files.append) files.append(scroll.render());
            else if (files.appendFiles) files.appendFiles(scroll.render());

            if (files.appendHead) files.appendHead(filter.render());
            else scroll.append(filter.render());
        }

        function clearList() {
            last = false;
            scroll.render().find('.empty').remove();
            filter.render().detach();
            scroll.clear();
            scroll.append(filter.render());
        }

        function empty(text) {
            clearList();

            var node;
            if (Lampa.Empty) {
                node = new Lampa.Empty({ text: text }).render();
            }
            else if (Lampa.Template && Lampa.Template.get) {
                node = Lampa.Template.get('list_empty');
                node.find('.empty__descr').text(text);
            }
            else {
                node = $('<div class="empty">' + escapeHtml(text) + '</div>');
            }

            scroll.append(node);
            self.loading(false);
        }

        function parsePlayerObject(str) {
            var compact = String(str || '').replace(/\n/g, '');
            var found = compact.match(/makePlayer\(\{([\s\S]*?)\}\);/);

            if (!found) return null;

            try {
                return (new Function('return ({' + found[1] + '});'))();
            }
            catch (e) {
                log('Collaps parse failed', e && e.message ? e.message : e);
                return null;
            }
        }

        function subtitles(list) {
            if (!list || !list.length) return false;

            return list.map(function (sub) {
                return {
                    label: sub.name || sub.label || 'Subtitles',
                    url: sub.url
                };
            }).filter(function (sub) {
                return !!sub.url;
            });
        }

        function audioInfo(source) {
            var audio = source && source.audio;
            var names = audio && audio.names;

            if (!names || !names.length) return '';

            return names.slice(0, 5).join(', ');
        }

        function maxQuality(data) {
            var map = data && data.qualityByWidth;
            var keys = map ? Object.keys(map) : [];
            var best = 0;

            keys.forEach(function (key) {
                best = Math.max(best, parseInt(map[key], 10) || 0);
            });

            return best ? best + 'p / ' : '';
        }

        function buildItems() {
            var result = [];

            if (extract && extract.playlist && extract.playlist.seasons) {
                var seasons = extract.playlist.seasons;
                var season = seasons[Math.min(choice.season, seasons.length - 1)] || seasons[0];

                if (season && season.episodes) {
                    season.episodes.forEach(function (episode) {
                        result.push({
                            file: episode.hls,
                            title: episode.title || ('S' + season.season + ' / ' + episode.episode),
                            quality: maxQuality(episode),
                            info: audioInfo(episode),
                            season: season.season,
                            episode: parseInt(episode.episode, 10) || 0,
                            subtitles: subtitles(episode.cc)
                        });
                    });
                }
            }
            else if (extract && extract.source) {
                result.push({
                    file: extract.source.hls,
                    title: extract.title || title(),
                    quality: maxQuality(extract),
                    info: audioInfo(extract.source),
                    subtitles: subtitles(extract.source.cc)
                });
            }

            return result.filter(function (item) {
                return !!item.file;
            });
        }

        function logCollapsShape() {
            if (extract && extract.playlist && extract.playlist.seasons) {
                var seasons = extract.playlist.seasons;
                var episodes = 0;
                var firstHls = '';

                seasons.forEach(function (season) {
                    if (season.episodes) {
                        episodes += season.episodes.length;
                        if (!firstHls && season.episodes[0]) firstHls = season.episodes[0].hls;
                    }
                });

                log('Collaps type: series, seasons=' + seasons.length + ', episodes=' + episodes);
                log('Collaps raw HLS URL: ' + (firstHls || 'not found'));
            }
            else if (extract && extract.source) {
                log('Collaps type: movie');
                log('Collaps raw HLS URL: ' + (extract.source.hls || 'not found'));
            }
            else {
                log('Collaps type: unknown');
                log('Collaps raw HLS URL: not found');
            }
        }
        function buildFilter() {
            var select = [];
            var seasons = extract && extract.playlist && extract.playlist.seasons ? extract.playlist.seasons : [];

            if (seasons.length > 1) {
                select.push({
                    title: lang('torrent_parser_reset', 'Сбросить'),
                    reset: true
                });

                select.push({
                    title: lang('torrent_serial_season', 'Сезон'),
                    subtitle: lang('torrent_serial_season', 'Сезон') + ' ' + seasons[Math.min(choice.season, seasons.length - 1)].season,
                    stype: 'season',
                    items: seasons.map(function (season, index) {
                        return {
                            title: lang('torrent_serial_season', 'Сезон') + ' ' + season.season,
                            selected: index === choice.season,
                            index: index
                        };
                    })
                });
            }

            filter.set('filter', select);
            if (filter.chosen) {
                filter.chosen('filter', seasons.length > 1 ? [lang('torrent_serial_season', 'Сезон') + ' ' + seasons[Math.min(choice.season, seasons.length - 1)].season] : []);
            }
        }

        function itemTemplate(element) {
            if (Lampa.Template && Lampa.Template.get) {
                return Lampa.Template.get('collaps_online_item', element);
            }

            return $('<div class="online selector"><div class="online__body"><div class="online__title">' + escapeHtml(element.title) + '</div><div class="online__quality">' + escapeHtml(element.quality + element.info) + '</div></div></div>');
        }

        function viewedHash(element) {
            var card = movie();
            var base = card.original_title || card.original_name || card.title || card.name || title();

            return Lampa.Utils.hash(element.season ? [element.season, element.episode, base, element.title].join('') : base + 'collaps');
        }

        function play(element) {
            var playlist = [];

            log('Collaps HLS URL: ' + element.file);
            var first = {
                url: element.file,
                timeline: element.timeline,
                title: element.title,
                subtitles: element.subtitles
            };

            if (element.season) {
                items.forEach(function (item) {
                    playlist.push({
                        title: item.title,
                        url: item.file,
                        timeline: item.timeline,
                        subtitles: item.subtitles
                    });
                });
            }
            else {
                playlist.push(first);
            }

            if (playlist.length > 1) first.playlist = playlist;

            Lampa.Player.play(first);
            Lampa.Player.playlist(playlist);
        }

        function appendList(list) {
            clearList();

            var viewed = Lampa.Storage.cache('online_view', 5000, []);
            var card = movie();
            var base = card.original_title || card.original_name || card.title || card.name || title();

            list.forEach(function (element) {
                var hash = Lampa.Utils.hash(element.season ? [element.season, element.episode, base].join('') : base);
                var view = Lampa.Timeline.view(hash);
                var item = itemTemplate(element);
                var hashFile = viewedHash(element);

                element.timeline = view;
                item.append(Lampa.Timeline.render(view));

                if (Lampa.Timeline.details) {
                    item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
                }

                if (viewed.indexOf(hashFile) !== -1) {
                    item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                }

                item.on('hover:enter', function () {
                    if (card.id) Lampa.Favorite.add('history', card, 100);

                    if (element.file) {
                        play(element);

                        if (viewed.indexOf(hashFile) === -1) {
                            viewed.push(hashFile);
                            item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                            Lampa.Storage.set('online_view', viewed);
                        }
                    }
                    else {
                        Lampa.Noty.show(lang('online_nolink', 'Не удалось извлечь ссылку'));
                    }
                });

                item.on('hover:focus', function (event) {
                    last = event.target;
                    scroll.update($(event.target), true);
                });

                item.on('hover:long', function () {
                    Lampa.Utils.copyTextToClipboard(element.file, function () {
                        Lampa.Noty.show(lang('copy_secuses', 'Ссылка скопирована'));
                    }, function () {
                        Lampa.Noty.show(lang('copy_error', 'Ошибка копирования'));
                    });
                });

                scroll.append(item);
            });

            self.start(true);
        }

        function load() {
            var kp = kpInfo();
            var id = kp.id;

            log('Collaps KP ID: ' + (id || 'not found') + (kp.path ? ' from ' + kp.path : ''));

            if (!id) {
                empty(lang('collaps_no_kp', 'Для Collaps нужен kinopoisk_id в карточке'));
                log('Collaps skipped: no kinopoisk_id');
                return;
            }

            network.clear();
            network.timeout(15000);
            var apiUrl = COLLAPS_BASE + 'kp/' + encodeURIComponent(id);
            log('Collaps API URL: ' + apiUrl);
            network.silent(apiUrl, function (str) {
                extract = parsePlayerObject(str);
                log('Collaps makePlayer: ' + (extract ? 'yes' : 'no'));

                if (!extract) {
                    empty(lang('collaps_no_streams', 'Collaps не вернул воспроизводимые потоки'));
                    log('Collaps parse returned no source for kp ' + id);
                    return;
                }

                choice.season = Math.max(0, choice.season || 0);
                buildFilter();
                logCollapsShape();
                items = buildItems();

                if (!items.length) {
                    empty(lang('collaps_no_streams', 'Collaps не вернул воспроизводимые потоки'));
                    log('Collaps returned no playable streams for kp ' + id);
                    return;
                }

                appendList(items);
                self.loading(false);
                log('Collaps ready for kp ' + id);
            }, function (a, c) {
                empty(network.errorDecode(a, c));
                log('Collaps load failed for kp ' + id, network.errorDecode(a, c));
            }, false, {
                dataType: 'text'
            });
        }

        this.create = function () {
            this.activity.loader(true);

            filter.onSearch = function (value) {
                Lampa.Activity.replace({
                    search: value,
                    clarification: true
                });
            };

            filter.onBack = function () {
                self.start();
            };

            filter.onSelect = function (type, a, b) {
                if (type !== 'filter') return;

                if (a.reset) {
                    choice = { season: 0 };
                }
                else if (a.stype === 'season') {
                    choice.season = b.index;
                }

                buildFilter();
                logCollapsShape();
                items = buildItems();
                appendList(items);
            };

            if (filter.addButtonBack) filter.addButtonBack();
            appendFiles();
            load();

            return this.render();
        };

        this.render = function () {
            return renderRoot();
        };

        this.loading = function (status) {
            if (status) this.activity.loader(true);
            else {
                this.activity.loader(false);
                this.activity.toggle();
            }
        };

        this.start = function (firstSelect) {
            if (Lampa.Activity.active().activity !== this.activity) return;

            if (firstSelect) {
                last = scroll.render().find('.selector.online').eq(0)[0] || last;
            }

            Lampa.Background.immediately(Lampa.Utils.cardImgBackground(movie()));

            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render(), renderRoot());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
                },
                up: function () {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () {
                    Navigator.move('down');
                },
                right: function () {
                    if (Navigator.canmove('right')) Navigator.move('right');
                    else filter.show(lang('title_filter', 'Фильтр'), 'filter');
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                back: this.back
            });

            Lampa.Controller.toggle('content');
        };

        this.back = function () {
            Lampa.Activity.backward();
        };

        this.pause = function () {};
        this.stop = function () {};

        this.destroy = function () {
            network.clear();
            scroll.destroy();
            filter.destroy();
            if (files.destroy) files.destroy();
        };
    }

    function openCollaps(card) {
        Lampa.Component.add('online_collaps', CollapsComponent);

        Lampa.Activity.push({
            url: '',
            title: lang('title_online', 'Онлайн') + ' - Collaps',
            component: 'online_collaps',
            search: card.title || card.name,
            search_one: card.title,
            search_two: card.original_title || card.original_name,
            movie: card,
            page: 1
        });
    }

    function installCollapsButton() {
        Lampa.Component.add('online_collaps', CollapsComponent);

        Lampa.Listener.follow('full', function (event) {
            if (event.type !== 'complite') return;

            var root = event.object.activity.render();
            if (root.find('.view--online-collaps').length) return;

            var container = root.find('.full-start-new__buttons');
            if (!container.length) container = root.find('.full-start__buttons');
            if (!container.length) return;

            var button = $('<div class="full-start__button selector view--online view--online-collaps" data-subtitle="Collaps">' +
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                    '<path d="M8 5v14l11-7L8 5z" fill="currentColor"/>' +
                '</svg>' +
                '<span>Collaps</span>' +
            '</div>');

            button.on('hover:enter', function () {
                openCollaps(event.data.movie);
            });

            var filmixButton = root.find('.view--online[data-subtitle*="Filmix"]').last();
            if (filmixButton.length) filmixButton.after(button);
            else container.prepend(button);
        });

        log('Collaps installed');
    }

    function start() {
        addCollapsLang();
        addCollapsTemplates();
        installCollapsButton();

        loadScript(FILMIX_URL, 'Filmix', function (loaded) {
            if (!loaded) log('Filmix unavailable; Collaps remains available');
        });
    }

    function bootstrap() {
        if (typeof Lampa === 'undefined') {
            setTimeout(bootstrap, 200);
            return;
        }

        if (window.appready) {
            start();
        }
        else {
            Lampa.Listener.follow('app', function (event) {
                if (event.type === 'ready') start();
            });
        }
    }

    bootstrap();
})();





