/* 
Copied from https://github.com/CassetteRocks/react-infinite-scroller
I thought it was too small to warrant needing a gigantic package managing infrastructure.
TODO: make sure we get the licencing right. Otherwise just rewrite this code.
*/
import * as React from 'react';
interface props {
    children: any,
    element?: string,
    hasMore?: boolean,
    initialLoad?: boolean,
    isReverse?: boolean,
    loader?: object,
    loadMore?: any,
    pageStart?: number,
    ref?: any,
    threshold?: number,
    useCapture?: boolean,
    useWindow?: boolean,
    className?: string
}
export class InfiniteScroll extends React.Component<props> {
    pageLoaded;
    defaultLoader;
    scrollComponent;
    static defaultProps = {
        element: 'div',
        hasMore: false,
        initialLoad: true,
        pageStart: 0,
        ref: null,
        threshold: 250,
        useWindow: true,
        isReverse: false,
        useCapture: false,
        loader: null,
    };

    constructor(props) {
        super(props);
        this.scrollListener = this.scrollListener.bind(this);
    }

    componentDidMount() {
        this.pageLoaded = this.props.pageStart;
        this.attachScrollListener();
    }

    componentDidUpdate() {
        this.attachScrollListener();
    }

    componentWillUnmount() {
        this.detachScrollListener();
        this.detachMousewheelListener();
    }

    // Set a defaut loader for all your `InfiniteScroll` components
    setDefaultLoader(loader) {
        this.defaultLoader = loader;
    }

    detachMousewheelListener() {
        let scrollEl = window;
        if (this.props.useWindow === false) {
            scrollEl = this.scrollComponent.parentNode;
        }

        scrollEl.removeEventListener(
            'mousewheel',
            this.mousewheelListener,
            this.props.useCapture,
        );
    }

    detachScrollListener() {
        let scrollEl = window;
        if (this.props.useWindow === false) {
            scrollEl = this.scrollComponent.parentNode;
        }

        scrollEl.removeEventListener(
            'scroll',
            this.scrollListener,
            this.props.useCapture,
        );
        scrollEl.removeEventListener(
            'resize',
            this.scrollListener,
            this.props.useCapture,
        );
    }

    attachScrollListener() {
        if (!this.props.hasMore) {
            return;
        }

        let scrollEl = window;
        if (this.props.useWindow === false) {
            scrollEl = this.scrollComponent.parentNode;
        }

        scrollEl.addEventListener(
            'mousewheel',
            this.mousewheelListener,
            this.props.useCapture,
        );
        scrollEl.addEventListener(
            'scroll',
            this.scrollListener,
            this.props.useCapture,
        );
        scrollEl.addEventListener(
            'resize',
            this.scrollListener,
            this.props.useCapture,
        );

        if (this.props.initialLoad) {
            this.scrollListener();
        }
    }

    mousewheelListener(e) {
        // Prevents Chrome hangups
        // See: https://stackoverflow.com/questions/47524205/random-high-content-download-time-in-chrome/47684257#47684257
        if (e.deltaY === 1) {
            e.preventDefault();
        }
    }

    scrollListener() {
        const el = this.scrollComponent;
        const scrollEl = window;

        let offset;
        if (this.props.useWindow) {
            const doc : any = document.documentElement || document.body.parentNode || document.body;
            const scrollTop =
                scrollEl.pageYOffset !== undefined
                    ? scrollEl.pageYOffset
                    : doc.scrollTop;
            if (this.props.isReverse) {
                offset = scrollTop;
            } else {
                offset =
                    this.calculateTopPosition(el) +
                    (el.offsetHeight - scrollTop - window.innerHeight);
            }
        } else if (this.props.isReverse) {
            offset = el.parentNode.scrollTop;
        } else {
            offset =
                el.scrollHeight - el.parentNode.scrollTop - el.parentNode.clientHeight;
        }

        if (offset < Number(this.props.threshold)) {
            this.detachScrollListener();
            // Call loadMore after detachScrollListener to allow for non-async loadMore functions
            if (typeof this.props.loadMore === 'function') {
                this.props.loadMore((this.pageLoaded += 1));
            }
        }
    }

    calculateTopPosition(el) {
        if (!el) {
            return 0;
        }
        return el.offsetTop + this.calculateTopPosition(el.offsetParent);
    }

    render() {
        const {
            children, element, hasMore, initialLoad, isReverse, loader, loadMore, 
            pageStart, ref, threshold, useCapture, useWindow, 
            ...props
        } = this.props;
        const childrenArray = [children];
        if (hasMore) {
            if (loader) {
                isReverse ? childrenArray.unshift(loader) : childrenArray.push(loader);
            } else if (this.defaultLoader) {
                isReverse
                    ? childrenArray.unshift(this.defaultLoader)
                    : childrenArray.push(this.defaultLoader);
            }
        }
        return React.createElement(element, {...props, ref : node => {
            this.scrollComponent = node;
            if (ref) { ref(node);}
        }}, childrenArray);
    }
}
